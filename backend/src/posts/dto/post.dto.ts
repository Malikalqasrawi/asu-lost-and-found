import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SERIAL_PATTERN } from '../../claims/serial.js';
import { TextLength } from '../../common/text-length.js';
import { trim } from '../../common/transforms.js';
import { Category, PostType } from '../../generated/prisma/client.js';
import { CURSOR } from '../cursor.js';

// One set of rules per field, shared by creating and editing a post.
// Titles go into emails to other students, so they can't carry a link to a
// look-alike sign-in page or an address to write to.
const ADDRESS_IN_TEXT =
  /:\/\/|www\.|@|[\p{L}\p{N}-]+\.(com|net|org|info|io|me|co|jo|edu|gov|app|site|online|link|xyz|ly|example)\b/iu;

const Title = () =>
  applyDecorators(
    Transform(trim),
    IsString(),
    TextLength(3, 80, {
      message: 'The title must be 3 to 80 characters on one line',
    }),
    Matches(new RegExp(`^(?!.*(?:${ADDRESS_IN_TEXT.source}))`, 'isu'), {
      message: 'Leave web and email addresses out of the title',
    }),
  );
const Description = () =>
  applyDecorators(
    Transform(trim),
    IsString(),
    TextLength(0, 1000, {
      message: 'The description can be at most 1000 characters',
      multiline: true,
    }),
  );
const PlaceDetails = () =>
  applyDecorators(
    Transform(trim),
    IsString(),
    TextLength(0, 120, {
      message: 'The place note can be at most 120 characters on one line',
    }),
  );
const Day = () =>
  Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'happenedOn must be a date like 2026-10-16',
  });

// A form field sent once arrives as a string and sent several times as an array.
const asList = ({ value }: { value: unknown }) =>
  value === undefined
    ? undefined
    : [value]
        .flat()
        .map((item) => (typeof item === 'string' ? item.trim() : item));

// Like @IsOptional, but a field sent as null is still checked (and refused),
// instead of reaching the database as null.
const IfPresent = () => ValidateIf((_object, value) => value !== undefined);

export class CreatePostDto {
  @IsEnum(PostType)
  type: PostType;

  @Title()
  title: string;

  @IsOptional()
  @Description()
  description?: string;

  @IsEnum(Category)
  category: Category;

  @IsUUID()
  placeId: string;

  @IsOptional()
  @PlaceDetails()
  placeDetails?: string;

  @Day()
  happenedOn: string;

  /** Found items: questions that only the owner can answer. */
  @IsOptional()
  @Transform(asList)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3, { message: 'Ask at most 3 questions' })
  @TextLength(5, 200, {
    message: 'Each question must be 5 to 200 characters on one line',
    each: true,
  })
  questions?: string[];

  /** Found items: details only the finder sees, to compare claims with. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @TextLength(0, 1000, {
    message: 'The private notes can be at most 1000 characters',
    multiline: true,
  })
  privateNotes?: string;

  /** Found electronics: the serial number or IMEI, kept only as a hash. */
  @IsOptional()
  @IsString()
  @Matches(SERIAL_PATTERN, {
    message:
      'The serial number needs at least 4 letters or digits; it can also have spaces and dashes',
  })
  serialNumber?: string;
}

export class UpdatePostDto {
  @IfPresent()
  @Title()
  title?: string;

  @IfPresent()
  @Description()
  description?: string;

  @IfPresent()
  @IsEnum(Category)
  category?: Category;

  @IfPresent()
  @IsUUID()
  placeId?: string;

  @IfPresent()
  @PlaceDetails()
  placeDetails?: string;

  @IfPresent()
  @Day()
  happenedOn?: string;
}

export class ListPostsQuery {
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @IsOptional()
  @IsUUID()
  placeId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Matches(CURSOR, { message: 'Invalid cursor' })
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
