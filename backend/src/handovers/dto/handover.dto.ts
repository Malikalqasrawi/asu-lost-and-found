import { Transform } from 'class-transformer';
import { IsIn, IsString, Matches } from 'class-validator';
import { TextLength } from '../../common/text-length.js';
import { trim } from '../../common/transforms.js';
import type { DeskStatus } from '../../generated/prisma/client.js';

export class SendMessageDto {
  @Transform(trim)
  @IsString()
  @TextLength(1, 1000, {
    message: 'A message must be 1 to 1000 characters',
    multiline: true,
  })
  text: string;
}

export class PickupCodeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s/g, '') : value,
  )
  @IsString()
  @Matches(/^\d{6}$/, { message: 'The pickup code has 6 digits' })
  code: string;
}

export class DeskListQuery {
  @IsIn(['ON_THE_WAY', 'AT_DESK'])
  status: Exclude<DeskStatus, 'PICKED_UP'>;
}
