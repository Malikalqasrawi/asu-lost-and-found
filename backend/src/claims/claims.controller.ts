import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { SendsEmail } from '../rate-limit/rate-limit.js';
import type { FinderClaimView, MyClaimView } from './claim-view.js';
import { ClaimForm, ClaimsService, FinderClaims } from './claims.service.js';
import { CreateClaimDto } from './dto/claim.dto.js';

/** The security office sees desk items unblurred, so its accounts can't claim anything. */
function checkMayClaim(user: AuthUser): void {
  if (user.role === 'SECURITY') {
    throw new ForbiddenException(
      "Security office accounts can't claim items. Use your student account.",
    );
  }
}

@Controller()
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get('posts/:id/claim-form')
  form(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ClaimForm> {
    checkMayClaim(user);
    return this.claims.claimForm(postId, user.id);
  }

  @Post('posts/:id/claims')
  @SendsEmail()
  create(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateClaimDto,
  ): Promise<MyClaimView> {
    checkMayClaim(user);
    return this.claims.create(postId, user.id, dto);
  }

  @Get('posts/:id/claims')
  forFinder(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<FinderClaims> {
    return this.claims.forFinder(postId, user.id);
  }

  @Get('claims/mine')
  mine(@CurrentUser() user: AuthUser): Promise<MyClaimView[]> {
    return this.claims.mine(user.id);
  }

  @Post('claims/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @Param('id', ParseUUIDPipe) claimId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<FinderClaimView> {
    return this.claims.accept(claimId, user.id);
  }

  @Post('claims/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id', ParseUUIDPipe) claimId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<FinderClaimView> {
    return this.claims.reject(claimId, user.id);
  }

  @Post('claims/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(
    @Param('id', ParseUUIDPipe) claimId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MyClaimView> {
    return this.claims.withdraw(claimId, user.id);
  }
}
