import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators.js';
import { MINUTE } from '../common/time.js';
import { PhotosService } from './photos.service.js';

// Browse shows a thumbnail per post, so photos get a bigger allowance.
@Throttle({ default: { limit: 600, ttl: MINUTE } })
@Controller('photos')
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get(':id')
  @Header('Content-Type', 'image/jpeg')
  @Header('Cache-Control', 'private, max-age=3600')
  async public(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.photos.readPublic(id, user.id));
  }

  @Get(':id/original')
  @Header('Content-Type', 'image/jpeg')
  @Header('Cache-Control', 'private, no-store')
  async original(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.photos.readOriginal(id, user.id));
  }
}
