import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { ClaimHistoryController } from './claim-history.controller.js';
import { ClaimHistoryService } from './claim-history.service.js';
import { ClaimsController } from './claims.controller.js';
import { ClaimsService } from './claims.service.js';
import { SerialHasher } from './serial.js';

@Module({
  imports: [MailModule],
  controllers: [ClaimsController, ClaimHistoryController],
  providers: [ClaimsService, ClaimHistoryService, SerialHasher],
  exports: [ClaimsService, SerialHasher],
})
export class ClaimsModule {}
