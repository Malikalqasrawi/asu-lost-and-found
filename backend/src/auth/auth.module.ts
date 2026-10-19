import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation.js';
import { MailModule } from '../mail/mail.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailCodesService } from './email-codes.service.js';
import { EmailRule } from './email-domain.js';
import { MicrosoftAuthService } from './microsoft-auth.service.js';
import {
  MicrosoftTokenVerifier,
  microsoftKeysProvider,
} from './microsoft-token.js';
import { ACCESS_TOKEN_TTL_SECONDS, TokensService } from './tokens.service.js';

const ISSUER = 'asu-lost-and-found';

@Module({
  imports: [
    MailModule,
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
          issuer: ISSUER,
        },
        verifyOptions: { algorithms: ['HS256'], issuer: ISSUER },
      }),
    }),
  ],
  controllers: [AuthController, AdminAuthController],
  providers: [
    AuthService,
    AdminAuthService,
    EmailCodesService,
    EmailRule,
    MicrosoftAuthService,
    MicrosoftTokenVerifier,
    microsoftKeysProvider,
    TokensService,
  ],
  exports: [EmailCodesService, EmailRule, TokensService],
})
export class AuthModule {}
