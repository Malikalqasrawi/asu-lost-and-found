import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { EnvironmentVariables } from '../config/env.validation.js';
import { GuessesSecret, SendsEmail } from '../rate-limit/rate-limit.js';
import {
  checkFromAdminSite,
  clearAdminCookie,
  readAdminCookie,
  setAdminCookie,
} from './admin-cookie.js';
import { AdminAuthService, type AdminChallenge } from './admin-auth.service.js';
import { Public } from './decorators.js';
import { AdminCodeDto, CredentialsDto } from './dto/auth.dto.js';
import type { UserProfile } from '../users/users.service.js';

interface AdminAccess {
  accessToken: string;
  expiresIn: number;
}

/** The refresh token never reaches the page: it lives in an httpOnly cookie. */
@Public()
@Controller('admin/auth')
export class AdminAuthController {
  private readonly adminOrigin: string;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly auth: AdminAuthService,
  ) {
    this.adminOrigin = config.get('ADMIN_SITE_ORIGIN', { infer: true });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @SendsEmail()
  @GuessesSecret()
  login(@Body() dto: CredentialsDto): Promise<AdminChallenge> {
    return this.auth.login(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @GuessesSecret()
  async verify(
    @Body() dto: AdminCodeDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminAccess & { user: UserProfile }> {
    const { refreshToken, ...session } = await this.auth.verify(dto);
    setAdminCookie(response, this.adminOrigin, refreshToken);
    return session;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminAccess> {
    checkFromAdminSite(request, this.adminOrigin);
    const token = readAdminCookie(request);
    if (!token) {
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }
    const { refreshToken, ...access } = await this.auth.refresh(token);
    setAdminCookie(response, this.adminOrigin, refreshToken);
    return access;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    checkFromAdminSite(request, this.adminOrigin);
    const token = readAdminCookie(request);
    if (token) {
      await this.auth.logout(token);
    }
    clearAdminCookie(response, this.adminOrigin);
  }
}
