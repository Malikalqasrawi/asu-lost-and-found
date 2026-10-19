import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { normalizeEmail } from '../../common/transforms.js';

const SIX_DIGITS = { message: 'The code has 6 digits' };

/** Proof that it is the student: their password, or a code sent to their email. */
export class ConfirmIdentityDto {
  @IsOptional()
  @IsString()
  @IsByteLength(1, 72)
  password?: string;

  @IsOptional()
  @Matches(/^\d{6}$/, SIX_DIGITS)
  code?: string;
}

export class ChangeEmailDto extends ConfirmIdentityDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  newEmail: string;
}

export class EmailCodeDto {
  @Matches(/^\d{6}$/, SIX_DIGITS)
  code: string;
}
