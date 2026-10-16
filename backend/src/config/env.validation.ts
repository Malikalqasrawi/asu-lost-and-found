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

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().replace(/\s+/g, '') : value,
  )
  @Matches(/^[a-z0-9-]+(\.[a-z0-9-]+)+(,[a-z0-9-]+(\.[a-z0-9-]+)+)*$/, {
    message: 'ALLOWED_EMAIL_DOMAINS must be a comma-separated list of domains',
  })
  ALLOWED_EMAIL_DOMAINS: string = 'asu.edu.jo';

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

  @IsInt()
  @Min(1)
  RATE_LIMIT_EMAILS_PER_HOUR: number = 10;

  @IsInt()
  @Min(1)
  RATE_LIMIT_LOGINS_PER_15_MIN: number = 10;
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
