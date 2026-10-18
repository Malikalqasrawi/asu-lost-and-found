import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router';

import { ActivityPage } from '@/pages/activity';
import { ClaimHistoryPage } from '@/pages/claim-history';
import { ReportsPage } from '@/pages/reports';
import { SignInPage } from '@/pages/sign-in';
import { StudentsPage } from '@/pages/students';
import { useSession } from '@/session/session';

function Shell() {
  const { user, signOut } = useSession();

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Lost &amp; Found admin</h1>
        <nav aria-label="Admin">
          <NavLink to="/reports">Reports</NavLink>
          <NavLink to="/students">Students</NavLink>
          <NavLink to="/claims">Claim history</NavLink>
          <NavLink to="/activity">Activity</NavLink>
        </nav>
        <span className="muted">{user?.fullName}</span>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <Routes>
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/claims" element={<ClaimHistoryPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="*" element={<Navigate to="/reports" replace />} />
      </Routes>
    </div>
  );
}

export function App() {
  const { status } = useSession();

  if (status === 'loading') {
    return null;
  }
  return <BrowserRouter>{status === 'signedIn' ? <Shell /> : <SignInPage />}</BrowserRouter>;
}
