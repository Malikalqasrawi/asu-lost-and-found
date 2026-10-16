export function parseDomains(list: string): string[] {
  return list
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(
  email: string,
  allowedDomains: string[],
): boolean {
  const at = email.lastIndexOf('@');
  if (at < 1) {
    return false;
  }
  return allowedDomains.includes(email.slice(at + 1).toLowerCase());
}
