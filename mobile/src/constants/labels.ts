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

export const typeLabels: Record<PostType, string> = {
  LOST: 'Lost',
  FOUND: 'Found',
};

export const statusLabels: Record<PostStatus, string> = {
  OPEN: 'Open',
  RETURNED: 'Returned',
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

export function localIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
