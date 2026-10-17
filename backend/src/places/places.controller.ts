import { Controller, Get } from '@nestjs/common';
import { PlacesService, PlaceView } from './places.service.js';

@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get()
  list(): Promise<PlaceView[]> {
    return this.places.list();
  }
}
