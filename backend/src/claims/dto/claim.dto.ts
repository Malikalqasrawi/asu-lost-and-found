import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { TextLength } from '../../common/text-length.js';
import { trim } from '../../common/transforms.js';
import { SERIAL_PATTERN } from '../serial.js';

export class AnswerDto {
  @IsUUID()
  questionId: string;

  @Transform(trim)
  @IsString()
  @TextLength(1, 300, {
    message: 'Each answer must be 1 to 300 characters',
    multiline: true,
  })
  answer: string;
}

export class CreateClaimDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @TextLength(0, 1000, {
    message: 'The message can be at most 1000 characters',
    multiline: true,
  })
  message?: string;

  @IsOptional()
  @IsString()
  @Matches(SERIAL_PATTERN, {
    message:
      'The serial number needs at least 4 letters or digits; it can also have spaces and dashes',
  })
  serialNumber?: string;
}
