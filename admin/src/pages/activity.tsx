import { useModerationLog, type ModerationAction } from '@/api/admin';
import { FormMessage } from '@/components/form-message';
import { formatDate } from '@/labels';

const actionLabels: Record<ModerationAction, string> = {
  HIDE_POST: 'Hid a post',
  RESTORE_POST: 'Showed a post again',
  REMOVE_MESSAGE: 'Removed a message',
  DISMISS_REPORTS: 'Dismissed reports',
  BAN: 'Banned',
  UNBAN: 'Lifted a ban',
};

/** Every moderation decision, the latest first, with the admin who made it. */
export function ActivityPage() {
  const log = useModerationLog();

  return (
    <section className="stack">
      <h2>Activity</h2>
      <FormMessage error={log.error} />
      {log.data?.length === 0 ? <p className="muted">No decisions yet.</p> : null}
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Admin</th>
            <th>Did</th>
            <th>About</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {log.data?.map((entry) => (
            <tr key={entry.id}>
              <td>{formatDate(entry.createdAt)}</td>
              <td>{entry.admin}</td>
              <td>{actionLabels[entry.action]}</td>
              <td>{entry.about}</td>
              <td>{entry.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
