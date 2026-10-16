import { Controller, Get, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { toProfile, UserProfile, UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() current: AuthUser): Promise<UserProfile> {
    const user = await this.users.findVerifiedById(current.id);
    if (!user) {
      throw new NotFoundException();
    }
    return toProfile(user);
  }
}
