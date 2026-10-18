import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { DeskController } from './desk.controller.js';
import { DeskService } from './desk.service.js';
import { HandoversController } from './handovers.controller.js';
import { HandoversService } from './handovers.service.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [MailModule],
  controllers: [HandoversController, DeskController],
  providers: [HandoversService, MessagesService, DeskService],
})
export class HandoversModule {}
