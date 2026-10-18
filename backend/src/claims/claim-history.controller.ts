import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import {
  ClaimantHistory,
  ClaimHistoryService,
} from './claim-history.service.js';

@Roles('ADMIN')
@Controller('admin/claimants')
export class ClaimHistoryController {
  constructor(private readonly history: ClaimHistoryService) {}

  @Get()
  claimants(): Promise<ClaimantHistory[]> {
    return this.history.claimants();
  }
}
