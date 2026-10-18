import {
  Controller,
  Delete,
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
import { DeskService, type DeskItemView } from './desk.service.js';
import { DeskListQuery } from './dto/handover.dto.js';

@Controller()
export class DeskController {
  constructor(private readonly desk: DeskService) {}

  @Post('posts/:id/desk')
  @HttpCode(HttpStatus.NO_CONTENT)
  handIn(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.desk.handIn(postId, user.id);
  }

  @Delete('posts/:id/desk')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.desk.cancel(postId, user.id);
  }

  @Get('desk/items')
  @Roles('SECURITY')
  list(@Query() query: DeskListQuery): Promise<DeskItemView[]> {
    return this.desk.list(query.status);
  }

  @Post('desk/items/:id/receive')
  @Roles('SECURITY')
  @HttpCode(HttpStatus.OK)
  receive(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DeskItemView> {
    return this.desk.receive(postId, user.id);
  }
}
