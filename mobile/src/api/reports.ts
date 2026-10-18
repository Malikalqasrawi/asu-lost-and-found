import { useMutation } from '@tanstack/react-query';

import { apiRequest } from '@/api/client';

export type ReportReason = 'SPAM' | 'FAKE' | 'OFFENSIVE' | 'PERSONAL_DETAILS' | 'OTHER';

/** What is being reported: a post, or a message in a handover chat. */
export type ReportTarget = { kind: 'post' | 'message'; id: string };

export interface NewReport {
  reason: ReportReason;
  details: string;
}

const pathFor = ({ kind, id }: ReportTarget) =>
  kind === 'post' ? `/posts/${id}/reports` : `/messages/${id}/reports`;

export const reportsApi = {
  send: (target: ReportTarget, report: NewReport) =>
    apiRequest<void>('POST', pathFor(target), { auth: true, body: report }),
};

export function useSendReport(target: ReportTarget) {
  return useMutation({ mutationFn: (report: NewReport) => reportsApi.send(target, report) });
}
