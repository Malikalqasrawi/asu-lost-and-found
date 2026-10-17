import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { EnvironmentVariables } from '../config/env.validation.js';

/** 4 to 40 characters with at least 4 letters or digits; spaces and dashes are ignored. */
export const SERIAL_PATTERN =
  /^(?=(?:[ -]*[A-Za-z0-9]){4})[A-Za-z0-9 -]{4,40}$/;

/**
 * Serial numbers are compared without spaces, dashes or letter case. Only a
 * keyed hash is stored: an IMEI has few enough possible values that a plain
 * hash could be reversed by trying them all.
 */
export function hashSerial(serial: string, key: string): string {
  const normalized = serial.toUpperCase().replace(/[\s-]/g, '');
  return createHmac('sha256', key).update(normalized).digest('hex');
}

@Injectable()
export class SerialHasher {
  private readonly key: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.key = config.get('SERIAL_HASH_KEY', { infer: true });
  }

  hash(serial: string): string {
    return hashSerial(serial, this.key);
  }
}
