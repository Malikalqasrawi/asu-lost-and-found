import { useState, type FormEvent } from 'react';

import { useStudents, useUnban, type Student } from '@/api/admin';
import { BanForm } from '@/components/ban-form';
import { FormMessage } from '@/components/form-message';
import { formatDate } from '@/labels';

function banText(student: Student): string {
  if (!student.ban) {
    return 'Active';
  }
  const until = student.ban.until ? `until ${formatDate(student.ban.until)}` : 'for good';
  return `Banned ${until}: ${student.ban.reason}`;
}

/** Find a student by name or email, and ban or unban them. */
export function StudentsPage() {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [banning, setBanning] = useState<Student | null>(null);
  const students = useStudents(query);
  const unban = useUnban();

  function search(event: FormEvent) {
    event.preventDefault();
    setQuery(draft.trim());
  }

  return (
    <section className="stack">
      <h2>Students</h2>
      <form className="row" onSubmit={search} role="search">
        <input
          aria-label="Name or email"
          placeholder="Name or email"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>
      <FormMessage error={students.error ?? unban.error} />
      {banning ? (
        <BanForm userId={banning.id} name={banning.fullName} onDone={() => setBanning(null)} />
      ) : null}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Joined</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {students.data?.map((student) => (
            <tr key={student.id}>
              <td>
                {student.fullName}
                {student.role !== 'STUDENT' ? (
                  <span className="badge"> {student.role.toLowerCase()}</span>
                ) : null}
              </td>
              <td>{student.email}</td>
              <td>{formatDate(student.createdAt)}</td>
              <td>{banText(student)}</td>
              <td>
                {student.ban ? (
                  <button
                    type="button"
                    disabled={unban.isPending}
                    onClick={() => unban.mutate(student.id)}>
                    Unban
                  </button>
                ) : student.role !== 'ADMIN' ? (
                  <button type="button" className="danger" onClick={() => setBanning(student)}>
                    Ban
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
