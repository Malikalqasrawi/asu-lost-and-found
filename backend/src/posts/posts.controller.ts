import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { MAX_PHOTO_BYTES, MAX_PHOTOS } from '../photos/photo-processor.js';
import { UploadsPhotos } from '../rate-limit/rate-limit.js';
import {
  CreatePostDto,
  ListPostsQuery,
  UpdatePostDto,
} from './dto/post.dto.js';
import type { PostView } from './post-view.js';
import { PostPage, PostsService } from './posts.service.js';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListPostsQuery,
  ): Promise<PostPage> {
    return this.posts.list(user.id, query);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser): Promise<PostView[]> {
    return this.posts.mine(user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PostView> {
    return this.posts.findOne(id, user.id);
  }

  @Post()
  @UploadsPhotos()
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS, {
      limits: {
        fileSize: MAX_PHOTO_BYTES,
        files: MAX_PHOTOS,
        fields: 16,
        fieldSize: 4096,
      },
    }),
  )
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePostDto,
    @UploadedFiles() photos: { buffer: Buffer }[] = [],
  ): Promise<PostView> {
    return this.posts.create(
      user.id,
      dto,
      photos.map((photo) => photo.buffer),
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePostDto,
  ): Promise<PostView> {
    return this.posts.update(id, user.id, dto);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PostView> {
    return this.posts.close(id, user.id);
  }
}
