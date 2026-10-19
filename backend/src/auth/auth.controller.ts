import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { GuessesSecret, SendsEmail } from '../rate-limit/rate-limit.js';
import { AuthResponse, AuthService } from './auth.service.js';
import { Public } from './decorators.js';
import { MicrosoftAuthService } from './microsoft-auth.service.js';
import {
  EmailDto,
  LoginDto,
  MicrosoftLoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto.js';
import { TokenPair } from './tokens.service.js';

const CHECK_YOUR_EMAIL = {
  message: 'If the email can be used, a 6-digit code is on its way.',
};

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly microsoft: MicrosoftAuthService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @SendsEmail()
  async register(@Body() dto: RegisterDto) {
    await this.auth.register(dto);
    return CHECK_YOUR_EMAIL;
  }

  @Post('resend-code')
  @HttpCode(HttpStatus.ACCEPTED)
  @SendsEmail()
  async resendCode(@Body() dto: EmailDto) {
    await this.auth.resendVerificationCode(dto.email);
    return CHECK_YOUR_EMAIL;
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @GuessesSecret()
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<AuthResponse> {
    return this.auth.verifyEmail(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @GuessesSecret()
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  @Post('microsoft/start')
  @HttpCode(HttpStatus.OK)
  microsoftStart(): Promise<{ nonce: string }> {
    return this.microsoft.start();
  }

  @Post('microsoft')
  @HttpCode(HttpStatus.OK)
  @GuessesSecret()
  microsoftLogin(@Body() dto: MicrosoftLoginDto): Promise<AuthResponse> {
    return this.microsoft.signIn(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @SendsEmail()
  async forgotPassword(@Body() dto: EmailDto) {
    await this.auth.forgotPassword(dto.email);
    return CHECK_YOUR_EMAIL;
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @GuessesSecret()
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.auth.resetPassword(dto);
  }
}
