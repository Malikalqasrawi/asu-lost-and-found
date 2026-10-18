import { useState } from 'react';

import { useCaseAction, type CaseAction, type ReportCase, type ReportTarget } from '@/api/admin';
import { AuthPhoto } from '@/components/auth-photo';
import { BanForm } from '@/components/ban-form';
import { FormMessage } from '@/components/form-message';
import { formatDate, reasonLabels } from '@/labels';

const confirmations: Record<CaseAction, string> = {
  hide: 'Hide this post from everyone but its author? They get an email.',
  restore: 'Show this post to students again?',
  remove: 'Remove this message from the chat for both students?',
  dismiss: 'Close these reports without changing anything?',
};

function TargetDetails({ target }: { target: ReportTarget }) {
  if (target.kind === 'MESSAGE') {
    return (
      <>
        <h3>Message about “{target.postTitle}”</h3>
        <p className="muted">
          Sent by {target.sender.fullName} ({target.sender.email}) on {formatDate(target.sentAt)}
          {target.removed ? ' · removed' : ''}
        </p>
        <p className="quote">{target.text}</p>
      </>
    );
  }
  return (
    <>
      <div className="row">
        <span className="badge">{target.type === 'LOST' ? 'Lost' : 'Found'}</span>
        {target.hidden ? (
          <span className="badge danger">
            {target.hiddenBy === 'BAN' ? 'Hidden by a ban' : 'Hidden'}
          </span>
        ) : null}
        <h3>{target.title}</h3>
      </div>
      <p className="muted">
        Posted by {target.author.fullName} ({target.author.email})
      </p>
      {target.description ? <p className="quote">{target.description}</p> : null}
      {target.photoIds.length > 0 ? (
        <div className="photos">
          {target.photoIds.map((photoId, index) => (
            <AuthPhoto
              key={photoId}
              photoId={photoId}
              alt={`Photo ${index + 1} of ${target.title}`}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * Decided cases can still have a hidden post shown again. A post hidden only
 * by a ban can still be hidden for good, so it stays hidden after the ban ends.
 */
function actionsFor({ target, status }: ReportCase): CaseAction[] {
  if (target.kind === 'MESSAGE') {
    if (status !== 'OPEN') {
      return [];
    }
    return target.removed ? ['dismiss'] : ['remove', 'dismiss'];
  }
  const byModerator = target.hiddenBy === 'MODERATION';
  if (status !== 'OPEN') {
    return byModerator ? ['restore'] : [];
  }
  return [byModerator ? 'restore' : 'hide', 'dismiss'];
}

const actionLabels: Record<CaseAction, string> = {
  hide: 'Hide post',
  restore: 'Show post again',
  remove: 'Remove message',
  dismiss: 'Dismiss reports',
};

export function ReportCaseCard({ item }: { item: ReportCase }) {
  const act = useCaseAction();
  const [banning, setBanning] = useState(false);
  const { target } = item;
  const person = target.kind === 'POST' ? target.author : target.sender;

  function run(action: CaseAction) {
    if (window.confirm(confirmations[action])) {
      act.mutate({ target, action });
    }
  }

  return (
    <article
      className="card"
      aria-label={target.kind === 'POST' ? target.title : `Message from ${person.fullName}`}>
      <TargetDetails target={target} />
      <ul>
        {item.reports.map((report) => (
          <li key={report.id}>
            <strong>{reasonLabels[report.reason]}</strong> · {report.reporter} ·{' '}
            {formatDate(report.createdAt)}
            {report.details ? <span className="muted"> — {report.details}</span> : null}
          </li>
        ))}
      </ul>
      <FormMessage error={act.error} />
      <div className="row">
        {actionsFor(item).map((action) => (
          <button key={action} type="button" onClick={() => run(action)} disabled={act.isPending}>
            {actionLabels[action]}
          </button>
        ))}
        <button type="button" className="danger" onClick={() => setBanning(true)}>
          Ban {person.fullName}
        </button>
      </div>
      {banning ? (
        <BanForm userId={person.id} name={person.fullName} onDone={() => setBanning(false)} />
      ) : null}
    </article>
  );
}
