import { useState } from 'react';

import { useReportCases, type ReportStatus } from '@/api/admin';
import { FormMessage } from '@/components/form-message';
import { ReportCaseCard } from '@/components/report-case-card';

const tabs: { status: ReportStatus; label: string }[] = [
  { status: 'OPEN', label: 'Waiting' },
  { status: 'RESOLVED', label: 'Acted on' },
  { status: 'DISMISSED', label: 'Dismissed' },
];

/** Every reported post or message, the most reported first. */
export function ReportsPage() {
  const [status, setStatus] = useState<ReportStatus>('OPEN');
  const cases = useReportCases(status);

  return (
    <section className="stack">
      <h2>Reports</h2>
      <div className="row" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.status}
            type="button"
            role="tab"
            aria-selected={status === tab.status}
            className={status === tab.status ? 'primary' : undefined}
            onClick={() => setStatus(tab.status)}>
            {tab.label}
          </button>
        ))}
      </div>
      <FormMessage error={cases.error} />
      {cases.data?.length === 0 ? <p className="muted">Nothing here.</p> : null}
      {cases.data?.map((item) => (
        <ReportCaseCard key={`${item.target.kind}:${item.target.id}`} item={item} />
      ))}
    </section>
  );
}
