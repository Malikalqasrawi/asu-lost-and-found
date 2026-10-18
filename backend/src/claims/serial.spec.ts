import { hashSerial, SERIAL_PATTERN } from './serial.js';

const key = 'k'.repeat(32);

describe('hashSerial', () => {
  it('ignores spaces, dashes and letter case', () => {
    expect(hashSerial('c02x-1234 abcd', key)).toBe(
      hashSerial('C02X1234ABCD', key),
    );
  });

  it('tells different serial numbers apart', () => {
    expect(hashSerial('C02X1234ABCD', key)).not.toBe(
      hashSerial('C02X1234ABCE', key),
    );
  });

  it('never contains the serial number itself', () => {
    expect(hashSerial('C02X1234ABCD', key)).not.toContain('C02X1234ABCD');
  });

  it('depends on the key, so a copy of the database alone is not enough', () => {
    expect(hashSerial('356789012345678', key)).not.toBe(
      hashSerial('356789012345678', 'z'.repeat(32)),
    );
  });
});

describe('SERIAL_PATTERN', () => {
  it.each(['C02X-1234-ABCD', '3567 8901 2345 678', 'ab12'])(
    'accepts %s',
    (serial) => {
      expect(SERIAL_PATTERN.test(serial)).toBe(true);
    },
  );

  it.each(['----', 'a- -b-c', 'ab!1234', 'x'.repeat(41)])(
    'refuses %s',
    (serial) => {
      expect(SERIAL_PATTERN.test(serial)).toBe(false);
    },
  );
});
