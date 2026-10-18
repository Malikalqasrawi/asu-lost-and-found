import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TextLength } from '../../common/text-length.js';
import { trim } from '../../common/transforms.js';
import { ReportReason, ReportStatus } from '../../generated/prisma/client.js';

export class ReportDto {
  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @TextLength(0, 500, {
    message: 'The details can be at most 500 characters',
    multiline: true,
  })
  details?: string;
}

export class ReportsQuery {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}

export class UsersQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class BanDto {
  @Transform(trim)
  @IsString()
  @TextLength(3, 500, {
    message: 'Give a reason of 3 to 500 characters; the student sees it',
    multiline: true,
  })
  reason: string;

  /** Leave out to ban for good. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}
