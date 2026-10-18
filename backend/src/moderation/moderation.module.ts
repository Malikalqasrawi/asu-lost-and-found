import { Module } from '@nestjs/common';
import { ClaimsModule } from '../claims/claims.module.js';
import { MailModule } from '../mail/mail.module.js';
import { AdminModerationController } from './admin-moderation.controller.js';
import { BansService } from './bans.service.js';
import { ModerationService } from './moderation.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [ClaimsModule, MailModule],
  controllers: [ReportsController, AdminModerationController],
  providers: [ReportsService, ModerationService, BansService],
})
export class ModerationModule {}
