import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { ClaimHistoryController } from './claim-history.controller.js';
import { ClaimHistoryService } from './claim-history.service.js';
import { ClaimsController } from './claims.controller.js';
import { ClaimsService } from './claims.service.js';
import { ClaimLimit } from './claim-limit.js';
import { SerialHasher } from './serial.js';

@Module({
  imports: [MailModule],
  controllers: [ClaimsController, ClaimHistoryController],
  providers: [ClaimsService, ClaimHistoryService, ClaimLimit, SerialHasher],
  exports: [ClaimsService, ClaimLimit, SerialHasher],
})
export class ClaimsModule {}
