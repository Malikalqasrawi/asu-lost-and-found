import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { MINUTE } from '../common/time.js';
import { GuessesSecret } from '../rate-limit/rate-limit.js';
import { PickupCodeDto, SendMessageDto } from './dto/handover.dto.js';
import type {
  HandoverSummary,
  HandoverView,
  MessageView,
} from './handover-view.js';
import { HandoversService } from './handovers.service.js';
import { MessagesService } from './messages.service.js';

@Controller()
export class HandoversController {
  constructor(
    private readonly handovers: HandoversService,
    private readonly messages: MessagesService,
  ) {}

  @Get('handovers/mine')
  mine(@CurrentUser() user: AuthUser): Promise<HandoverSummary[]> {
    return this.handovers.mine(user.id);
  }

  @Get('posts/:id/handover')
  view(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<HandoverView> {
    return this.handovers.view(postId, user.id);
  }

  @Post('posts/:id/handover/new-code')
  @HttpCode(HttpStatus.OK)
  newCode(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<HandoverView> {
    return this.handovers.newCode(postId, user.id);
  }

  @Post('posts/:id/handover/return')
  @GuessesSecret()
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmReturn(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: PickupCodeDto,
  ): Promise<void> {
    return this.handovers.confirmReturn(postId, user, dto.code);
  }

  @Get('posts/:id/messages')
  list(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MessageView[]> {
    return this.messages.list(postId, user.id);
  }

  @Post('posts/:id/messages')
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  send(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto,
  ): Promise<MessageView> {
    return this.messages.send(postId, user.id, dto.text);
  }
}
