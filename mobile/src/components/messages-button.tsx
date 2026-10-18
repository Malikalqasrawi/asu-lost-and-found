import { useRouter } from 'expo-router';

import type { Handover } from '@/api/handovers';
import { Button } from '@/components/button';

export function MessagesButton({ handover }: { handover: Handover }) {
  const router = useRouter();
  const { firstName } = handover.otherPerson;
  const title = handover.unread
    ? `Messages with ${firstName} (${handover.unread} new)`
    : `Messages with ${firstName}`;

  return (
    <Button
      title={title}
      variant="secondary"
      onPress={() => router.push(`/posts/${handover.postId}/chat`)}
    />
  );
}
