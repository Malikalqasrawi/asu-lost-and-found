import { useClaimHistory } from '@/api/admin';
import { FormMessage } from '@/components/form-message';

/** Students by rejected claims: someone trying their luck on many items stands out. */
export function ClaimHistoryPage() {
  const history = useClaimHistory();

  return (
    <section className="stack">
      <h2>Claim history</h2>
      <FormMessage error={history.error} />
      {history.data?.length === 0 ? <p className="muted">No claims yet.</p> : null}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Claims</th>
            <th>Accepted</th>
            <th>Rejected</th>
          </tr>
        </thead>
        <tbody>
          {history.data?.map((row) => (
            <tr key={row.userId}>
              <td>{row.fullName}</td>
              <td>{row.email}</td>
              <td>{row.claims}</td>
              <td>{row.accepted}</td>
              <td>{row.rejected}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
