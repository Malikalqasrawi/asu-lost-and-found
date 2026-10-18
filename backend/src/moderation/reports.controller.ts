import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { HOUR } from '../common/time.js';
import { ReportDto } from './dto/moderation.dto.js';
import { ReportsService } from './reports.service.js';

@Controller()
@Throttle({ default: { limit: 20, ttl: HOUR } })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('posts/:id/reports')
  @HttpCode(HttpStatus.NO_CONTENT)
  reportPost(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReportDto,
  ): Promise<void> {
    return this.reports.reportPost(postId, user.id, dto);
  }

  @Post('messages/:id/reports')
  @HttpCode(HttpStatus.NO_CONTENT)
  reportMessage(
    @Param('id', ParseUUIDPipe) messageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReportDto,
  ): Promise<void> {
    return this.reports.reportMessage(messageId, user.id, dto);
  }
}
