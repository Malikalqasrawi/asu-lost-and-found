import { Module } from '@nestjs/common';
import { ClaimsModule } from '../claims/claims.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { PlacesModule } from '../places/places.module.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [ClaimsModule, PhotosModule, PlacesModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
