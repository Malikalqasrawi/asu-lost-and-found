import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PlaceView {
  id: string;
  name: string;
}

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<PlaceView[]> {
    return this.prisma.campusPlace.findMany({
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.campusPlace.count({ where: { id } })) === 1;
  }
}
