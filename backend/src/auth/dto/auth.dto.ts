import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trim } from '../../common/transforms.js';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const PASSWORD_MIN = 8;
// bcrypt ignores everything after 72 bytes. Arabic letters take 2 bytes each.
const PASSWORD_MAX_BYTES = 72;
const tooLong = { message: 'Your password is too long' };

export class EmailDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;
}

export class RegisterDto extends EmailDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Your name must be 2 to 80 characters' })
  // Words of letters, with apostrophes or hyphens inside and a dot only at the
  // end ("Dr."), so a name can't look like a web address.
  @Matches(/^\p{L}[\p{L}\p{M}'-]*\.?( \p{L}[\p{L}\p{M}'-]*\.?)*$/u, {
    message:
      'Use only letters, spaces, apostrophes, dots and hyphens in your name',
  })
  fullName: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `Use at least ${PASSWORD_MIN} characters for your password`,
  })
  @IsByteLength(0, PASSWORD_MAX_BYTES, tooLong)
  password: string;
}

export class LoginDto extends EmailDto {
  @IsString()
  @IsByteLength(0, PASSWORD_MAX_BYTES, tooLong)
  password: string;
}

export class VerifyEmailDto extends LoginDto {
  @Matches(/^\d{6}$/, { message: 'The code has 6 digits' })
  code: string;
}

export class ResetPasswordDto extends EmailDto {
  @Matches(/^\d{6}$/, { message: 'The code has 6 digits' })
  code: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `Use at least ${PASSWORD_MIN} characters for your password`,
  })
  @IsByteLength(0, PASSWORD_MAX_BYTES, tooLong)
  newPassword: string;
}

export class RefreshTokenDto {
  @IsString()
  @Length(20, 200)
  refreshToken: string;
}
