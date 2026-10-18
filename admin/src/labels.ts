import type { ReportReason } from '@/api/admin';

export const reasonLabels: Record<ReportReason, string> = {
  SPAM: 'Spam',
  FAKE: 'Fake or misleading',
  OFFENSIVE: 'Offensive',
  PERSONAL_DETAILS: 'Shows personal details',
  OTHER: 'Something else',
};

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
