import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
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
import { TextLength } from '../../common/text-length.js';
import { trim } from '../../common/transforms.js';
import { Category, PostType } from '../../generated/prisma/client.js';
import { CURSOR } from '../cursor.js';

// One set of rules per field, shared by creating and editing a post.
const Title = () =>
  applyDecorators(
    Transform(trim),
    IsString(),
    TextLength(3, 80, {
      message: 'The title must be 3 to 80 characters on one line',
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
