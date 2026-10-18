import { useState } from 'react';
import { Alert } from 'react-native';

import { useDeskItems, useReceiveItem, type DeskItem, type DeskQueue } from '@/api/desk';
import { errorMessage } from '@/api/errors';
import { ChoiceChips, type Choice } from '@/components/choice-chips';
import { DeskItemCard } from '@/components/desk-item-card';
import { FormMessage } from '@/components/form-message';
import { ItemList } from '@/components/item-list';
import { ThemedText } from '@/components/themed-text';

const views: Choice<DeskQueue>[] = [
  { value: 'ON_THE_WAY', label: 'On the way' },
  { value: 'AT_DESK', label: 'At the desk' },
];

const emptyTexts: Record<DeskQueue, string> = {
  ON_THE_WAY: 'Nobody is bringing an item right now.',
  AT_DESK: 'The desk holds no items right now.',
};

const keyOf = (item: DeskItem) => item.postId;

/** The security office: items students bring in, and items waiting for their owner. */
export default function DeskScreen() {
  const [status, setStatus] = useState<DeskQueue>('ON_THE_WAY');
  const items = useDeskItems(status);
  const receive = useReceiveItem();

  function confirmReceive(item: DeskItem) {
    Alert.alert(`Received "${item.title}"?`, `${item.finder.fullName} handed it in at the desk.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Received', onPress: () => receive.mutate(item.postId) },
    ]);
  }

  return (
    <ItemList
      items={items.data ?? []}
      query={items}
      keyOf={keyOf}
      renderItem={({ item }) => (
        <DeskItemCard item={item} busy={receive.isPending} onReceive={confirmReceive} />
      )}
      emptyText={emptyTexts[status]}
      header={
        <>
          <ThemedText type="subtitle" accessibilityRole="header">
            Security desk
          </ThemedText>
          <ChoiceChips choices={views} selected={status} onSelect={setStatus} />
          <FormMessage message={receive.isError ? errorMessage(receive.error) : null} />
        </>
      }
    />
  );
}
