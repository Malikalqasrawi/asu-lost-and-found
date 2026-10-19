import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// docker compose passes an unset variable as an empty string.
const emptyAsMissing = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class EnvironmentVariables {
  @Matches(/^postgres(ql)?:\/\/.+/, {
    message: 'DATABASE_URL must be a postgresql:// connection string',
  })
  DATABASE_URL: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET: string;

  @IsString()
  @MinLength(32, { message: 'SERIAL_HASH_KEY must be at least 32 characters' })
  SERIAL_HASH_KEY: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().replace(/\s+/g, '') : value,
  )
  @Matches(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, {
    message: 'STUDENT_EMAIL_DOMAIN must be a domain like students.asu.edu.jo',
  })
  STUDENT_EMAIL_DOMAIN: string = 'students.asu.edu.jo';

  /** Staff (security office, admins) sign up with any address here; empty for none. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().replace(/\s+/g, '') : value,
  )
  @Matches(/^([a-z0-9-]+(\.[a-z0-9-]+)+(,[a-z0-9-]+(\.[a-z0-9-]+)+)*)?$/, {
    message: 'STAFF_EMAIL_DOMAINS must be a comma-separated list of domains',
  })
  STAFF_EMAIL_DOMAINS: string = 'asu.edu.jo';

  @IsString()
  MAIL_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  MAIL_PORT: number = 1025;

  @Transform(({ obj }: { obj: Record<string, unknown> }) =>
    [true, 'true'].includes(obj.MAIL_SECURE as string | boolean),
  )
  @IsBoolean()
  MAIL_SECURE: boolean = false;

  @IsOptional()
  @IsString()
  MAIL_USERNAME?: string;

  @IsOptional()
  @IsString()
  MAIL_PASSWORD?: string;

  @IsString()
  MAIL_FROM: string = 'ASU Lost & Found <no-reply@asu-lost-found.local>';

  @IsString()
  @MinLength(1)
  UPLOAD_DIR: string = 'uploads';

  @IsInt()
  @Min(1)
  RATE_LIMIT_EMAILS_PER_HOUR: number = 10;

  @IsInt()
  @Min(1)
  RATE_LIMIT_LOGINS_PER_15_MIN: number = 10;

  @IsInt()
  @Min(1)
  RATE_LIMIT_UPLOADS_PER_MINUTE: number = 5;

  /** The app registration in Microsoft Entra; Microsoft sign-in is off until both are set. */
  @Transform(emptyAsMissing)
  @IsOptional()
  @Matches(GUID, {
    message: 'MICROSOFT_CLIENT_ID must be the Application (client) ID, a GUID',
  })
  MICROSOFT_CLIENT_ID?: string;

  /** The university's Microsoft tenant: only its accounts can sign in. */
  @Transform(emptyAsMissing)
  @IsOptional()
  @Matches(GUID, {
    message: 'MICROSOFT_TENANT_ID must be the Directory (tenant) ID, a GUID',
  })
  MICROSOFT_TENANT_ID?: string;

  /** The admin website, the only other site allowed to call the API from a browser. */
  @Matches(/^https?:\/\/[^/\s]+$/, {
    message:
      'ADMIN_SITE_ORIGIN must be an origin like https://admin.example.com',
  })
  ADMIN_SITE_ORIGIN: string = 'http://localhost:4001';
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const problems = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('; ');
    throw new Error(`Invalid environment: ${problems}`);
  }
  return env;
}
