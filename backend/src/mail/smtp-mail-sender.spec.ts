import { requiresStartTls } from './smtp-mail-sender.js';

describe('requiresStartTls', () => {
  it.each(['localhost', '127.0.0.1', 'mailpit', 'MailPit'])(
    'lets the local inbox %s use plain SMTP',
    (host) => {
      expect(requiresStartTls(host, false)).toBe(false);
    },
  );

  it('insists on TLS for a real mail server on port 587', () => {
    expect(requiresStartTls('smtp.gmail.com', false)).toBe(true);
  });

  it('does not ask for STARTTLS when the connection is already TLS', () => {
    expect(requiresStartTls('smtp.gmail.com', true)).toBe(false);
  });
});
