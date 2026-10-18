import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { BansService, type StudentView } from './bans.service.js';
import { BanDto, ReportsQuery, UsersQuery } from './dto/moderation.dto.js';
import { ModerationService } from './moderation.service.js';
import type { LogEntryView } from './moderation-log.js';
import type { ReportCase } from './report-cases.js';

@Roles('ADMIN')
@Controller('admin')
export class AdminModerationController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly bans: BansService,
  ) {}

  @Get('reports')
  reports(@Query() query: ReportsQuery): Promise<ReportCase[]> {
    return this.moderation.cases(query.status);
  }

  @Post('posts/:id/hide')
  @HttpCode(HttpStatus.NO_CONTENT)
  hidePost(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.moderation.hidePost(postId, admin.id);
  }

  @Post('posts/:id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  restorePost(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.moderation.restorePost(postId, admin.id);
  }

  @Post('posts/:id/reports/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismissPostReports(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.moderation.dismiss({ postId }, admin.id);
  }

  @Post('messages/:id/remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMessage(
    @Param('id', ParseUUIDPipe) messageId: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.moderation.removeMessage(messageId, admin.id);
  }

  @Post('messages/:id/reports/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismissMessageReports(
    @Param('id', ParseUUIDPipe) messageId: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<void> {
    return this.moderation.dismiss({ messageId }, admin.id);
  }

  @Get('users')
  users(@Query() query: UsersQuery): Promise<StudentView[]> {
    return this.bans.search(query.q);
  }

  @Post('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  ban(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser() admin: AuthUser,
    @Body() dto: BanDto,
  ): Promise<StudentView> {
    return this.bans.ban(userId, admin.id, dto);
  }

  @Post('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  unban(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<StudentView> {
    return this.bans.unban(userId, admin.id);
  }

  @Get('log')
  log(): Promise<LogEntryView[]> {
    return this.moderation.log();
  }
}
