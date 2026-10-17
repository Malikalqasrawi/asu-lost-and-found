import { ValidateBy } from 'class-validator';

// Matching control characters is the point of these two patterns.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
// eslint-disable-next-line no-control-regex
const CONTROL_OR_LINE_BREAK = /[\u0000-\u001F\u007F]/;

interface TextLengthOptions {
  message: string;
  multiline?: boolean;
}

/**
 * Counts characters the way PostgreSQL's char_length does (one per code point),
 * so the API never accepts text that the database's CHECK constraints refuse.
 * Also refuses control characters such as NUL, which a text column can't store.
 */
export function TextLength(
  min: number,
  max: number,
  { message, multiline = false }: TextLengthOptions,
) {
  return ValidateBy({
    name: 'textLength',
    validator: {
      validate: (value: unknown) => {
        if (typeof value !== 'string') {
          return false;
        }
        if ((multiline ? CONTROL : CONTROL_OR_LINE_BREAK).test(value)) {
          return false;
        }
        // Code points on purpose: that is what char_length counts.
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        const length = [...value].length;
        return length >= min && length <= max;
      },
      defaultMessage: () => message,
    },
  });
}
