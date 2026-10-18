import type { ClaimStatus } from '@/api/claims';
import type { Category, PostStatus, PostType } from '@/api/posts';

export const categoryLabels: Record<Category, string> = {
  PHONE: 'Phone',
  LAPTOP: 'Laptop',
  WALLET: 'Wallet',
  KEYS: 'Keys',
  BAG: 'Bag',
  ID_CARD: 'ID card',
  BOOKS: 'Books',
  CLOTHING: 'Clothing',
  ELECTRONICS: 'Electronics',
  JEWELRY: 'Jewelry',
  OTHER: 'Other',
};

/** Categories the app suggests leaving at the university security office. */
export const deskSuggested: Category[] = [
  'PHONE',
  'LAPTOP',
  'WALLET',
  'ID_CARD',
  'ELECTRONICS',
  'JEWELRY',
];

export const typeLabels: Record<PostType, string> = {
  LOST: 'Lost',
  FOUND: 'Found',
};

export const statusLabels: Record<PostStatus, string> = {
  OPEN: 'Open',
  CLAIMED: 'Claimed',
  RETURNED: 'Returned',
  CLOSED: 'Closed',
};

export const claimStatusLabels: Record<ClaimStatus, string> = {
  PENDING: 'Waiting for the finder',
  ACCEPTED: 'Accepted',
  REJECTED: 'Not accepted',
  WITHDRAWN: 'Withdrawn',
  CLOSED: 'No longer open',
};

export const reviewStatusLabels: Record<ClaimStatus, string> = {
  PENDING: 'Waiting for you',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  CLOSED: 'Closed',
};

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return dayFormat.format(new Date(year, month - 1, day));
}

export function formatTimestamp(isoTimestamp: string): string {
  return dayFormat.format(new Date(isoTimestamp));
}

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayAndTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** "14:05" for today, "16 Oct, 14:05" for earlier days. */
export function formatMessageTime(isoTimestamp: string, now = new Date()): string {
  const date = new Date(isoTimestamp);
  const today = date.toDateString() === now.toDateString();
  return (today ? timeFormat : dayAndTimeFormat).format(date);
}

export function localIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localIsoDate(date);
}
