import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { MatchesService, type MatchView } from './matches.service.js';

@Controller('posts/:id/matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get()
  list(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MatchView[]> {
    return this.matches.forLostPost(postId, user.id);
  }

  @Post(':foundId/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismiss(
    @Param('id', ParseUUIDPipe) postId: string,
    @Param('foundId', ParseUUIDPipe) foundPostId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.matches.dismiss(postId, foundPostId, user.id);
  }
}
