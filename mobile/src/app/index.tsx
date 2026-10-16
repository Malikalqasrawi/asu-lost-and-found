import { Redirect } from 'expo-router';

import { useSession } from '@/session/session-provider';

export default function Index() {
  const { status } = useSession();
  return <Redirect href={status === 'signedIn' ? '/home' : '/sign-in'} />;
}
