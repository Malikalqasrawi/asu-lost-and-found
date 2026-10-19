import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClaimsModule } from '../claims/claims.module.js';
import { MailModule } from '../mail/mail.module.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';

@Module({
  imports: [AuthModule, ClaimsModule, MailModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
