import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';

export type ReportReason = 'SPAM' | 'FAKE' | 'OFFENSIVE' | 'PERSONAL_DETAILS' | 'OTHER';
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export interface Person {
  id: string;
  fullName: string;
  email: string;
}

export type ReportTarget =
  | {
      kind: 'POST';
      id: string;
      title: string;
      description: string;
      photoIds: string[];
      type: 'LOST' | 'FOUND';
      status: string;
      hidden: boolean;
      hiddenBy: 'MODERATION' | 'BAN' | null;
      author: Person;
    }
  | {
      kind: 'MESSAGE';
      id: string;
      text: string;
      removed: boolean;
      sentAt: string;
      postTitle: string;
      sender: Person;
    };

export interface ReportCase {
  target: ReportTarget;
  status: ReportStatus;
  reports: {
    id: string;
    reason: ReportReason;
    details: string;
    reporter: string;
    createdAt: string;
  }[];
}

export interface Student {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'SECURITY' | 'ADMIN';
  createdAt: string;
  ban: { since: string; until: string | null; reason: string } | null;
}

export interface ClaimantHistory {
  userId: string;
  fullName: string;
  email: string;
  claims: number;
  accepted: number;
  rejected: number;
}

export interface BanRequest {
  reason: string;
  /** Leave out to ban for good. */
  days?: number;
}

export type CaseAction = 'hide' | 'restore' | 'remove' | 'dismiss';

/** The API route for each decision about a reported post or message. */
function actionPath(target: ReportTarget, action: CaseAction): string {
  const base =
    target.kind === 'POST' ? `/admin/posts/${target.id}` : `/admin/messages/${target.id}`;
  return action === 'dismiss' ? `${base}/reports/dismiss` : `${base}/${action}`;
}

export function useReportCases(status: ReportStatus) {
  return useQuery({
    queryKey: ['reports', status],
    queryFn: () => api<ReportCase[]>('GET', `/admin/reports?status=${status}`),
  });
}

export function useCaseAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ target, action }: { target: ReportTarget; action: CaseAction }) =>
      api<void>('POST', actionPath(target, action)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
        queryClient.invalidateQueries({ queryKey: ['log'] }),
      ]),
  });
}

export function useStudents(query: string) {
  return useQuery({
    queryKey: ['students', query],
    queryFn: () => api<Student[]>('GET', `/admin/users?q=${encodeURIComponent(query)}`),
  });
}

export function useBan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ban }: { userId: string; ban: BanRequest }) =>
      api<Student>('POST', `/admin/users/${userId}/ban`, ban),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
        queryClient.invalidateQueries({ queryKey: ['log'] }),
      ]),
  });
}

export function useUnban() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<Student>('POST', `/admin/users/${userId}/unban`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['log'] }),
      ]),
  });
}

export function useClaimHistory() {
  return useQuery({
    queryKey: ['claimants'],
    queryFn: () => api<ClaimantHistory[]>('GET', '/admin/claimants'),
  });
}

export type ModerationAction =
  'HIDE_POST' | 'RESTORE_POST' | 'REMOVE_MESSAGE' | 'DISMISS_REPORTS' | 'BAN' | 'UNBAN';

export interface LogEntry {
  id: string;
  action: ModerationAction;
  admin: string;
  about: string;
  note: string;
  createdAt: string;
}

export function useModerationLog() {
  return useQuery({
    queryKey: ['log'],
    queryFn: () => api<LogEntry[]>('GET', '/admin/log'),
  });
}
