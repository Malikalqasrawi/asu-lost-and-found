import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { GuessesSecret, SendsEmail } from '../rate-limit/rate-limit.js';
import { AccountService, type EmailChanged } from './account.service.js';
import {
  ChangeEmailDto,
  ConfirmIdentityDto,
  EmailCodeDto,
} from './dto/account.dto.js';

const CHECK_YOUR_EMAIL = { message: 'A 6-digit code is on its way.' };

@Controller('users/me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Post('confirmation-code')
  @HttpCode(HttpStatus.ACCEPTED)
  @SendsEmail()
  async sendConfirmationCode(@CurrentUser() user: AuthUser) {
    await this.account.sendConfirmationCode(user.id);
    return CHECK_YOUR_EMAIL;
  }

  @Post('email')
  @HttpCode(HttpStatus.ACCEPTED)
  @SendsEmail()
  @GuessesSecret()
  async startEmailChange(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeEmailDto,
  ) {
    await this.account.startEmailChange(user.id, dto);
    return CHECK_YOUR_EMAIL;
  }

  @Post('email/confirm')
  @HttpCode(HttpStatus.OK)
  @GuessesSecret()
  confirmEmailChange(
    @CurrentUser() user: AuthUser,
    @Body() dto: EmailCodeDto,
  ): Promise<EmailChanged> {
    return this.account.confirmEmailChange(user.id, dto.code);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @GuessesSecret()
  deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmIdentityDto,
  ): Promise<void> {
    return this.account.deleteAccount(user.id, dto);
  }
}
