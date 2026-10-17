import { validateSync } from 'class-validator';
import { TextLength } from './text-length.js';

class Example {
  @TextLength(3, 10, { message: 'title' })
  title: string;

  @TextLength(0, 10, { message: 'notes', multiline: true })
  notes = '';
}

function errorsFor(values: Partial<Example>): string[] {
  const example = Object.assign(new Example(), values);
  return validateSync(example).map((error) => error.property);
}

describe('TextLength', () => {
  it('accepts text within the limits', () => {
    expect(errorsFor({ title: 'Wallet', notes: 'Two\nlines' })).toEqual([]);
  });

  it('counts an emoji with a variation selector as two characters, like PostgreSQL', () => {
    expect(errorsFor({ title: 'a'.repeat(9) + '❤️' })).toEqual(['title']);
    expect(errorsFor({ title: 'a'.repeat(8) + '❤️' })).toEqual([]);
  });

  it('refuses text that is too short', () => {
    expect(errorsFor({ title: 'ab' })).toEqual(['title']);
  });

  it('refuses a NUL character', () => {
    expect(errorsFor({ title: 'Wal\u0000let' })).toEqual(['title']);
    expect(errorsFor({ title: 'Wallet', notes: 'a\u0000b' })).toEqual([
      'notes',
    ]);
  });

  it('refuses line breaks unless the field is multiline', () => {
    expect(errorsFor({ title: 'Black\nwallet' })).toEqual(['title']);
  });

  it('refuses anything that is not a string', () => {
    expect(errorsFor({ title: 42 as unknown as string })).toEqual(['title']);
  });
});
