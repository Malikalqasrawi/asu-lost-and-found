import { useState, type FormEvent } from 'react';

import { useBan } from '@/api/admin';
import { FormMessage } from '@/components/form-message';

const DURATIONS = [
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'For good', days: 0 },
];

interface BanFormProps {
  userId: string;
  name: string;
  onDone: () => void;
}

/** The student sees the reason in their email, so it should explain the ban. */
export function BanForm({ userId, name, onDone }: BanFormProps) {
  const ban = useBan();
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);
  const [problem, setProblem] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setProblem('Give a reason the student can understand.');
      return;
    }
    setProblem(null);
    ban.mutate(
      { userId, ban: { reason: reason.trim(), ...(days ? { days } : {}) } },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="card" onSubmit={submit} aria-label={`Ban ${name}`}>
      <h3>Ban {name}</h3>
      <p className="muted">
        They are signed out everywhere, their open posts are hidden and their waiting claims are
        closed. They get an email with your reason.
      </p>
      <label>
        Reason
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          rows={3}
        />
      </label>
      <label>
        How long
        <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {DURATIONS.map((duration) => (
            <option key={duration.label} value={duration.days}>
              {duration.label}
            </option>
          ))}
        </select>
      </label>
      {problem ? (
        <p role="alert" className="message">
          {problem}
        </p>
      ) : null}
      <FormMessage error={ban.error} />
      <div className="row">
        <button type="submit" className="danger" disabled={ban.isPending}>
          Ban
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
