import { useMyHandovers, type HandoverSummary } from '@/api/handovers';
import { HandoverCard } from '@/components/handover-card';
import { ItemList } from '@/components/item-list';
import { ThemedText } from '@/components/themed-text';

const keyOf = (handover: HandoverSummary) => handover.postId;
const renderHandover = ({ item }: { item: HandoverSummary }) => <HandoverCard handover={item} />;

export default function MessagesScreen() {
  const handovers = useMyHandovers();

  return (
    <ItemList
      items={handovers.data ?? []}
      query={handovers}
      keyOf={keyOf}
      renderItem={renderHandover}
      emptyText="No messages yet. A chat opens when a finder accepts a claim."
      header={
        <ThemedText type="subtitle" accessibilityRole="header">
          Messages
        </ThemedText>
      }
    />
  );
}
