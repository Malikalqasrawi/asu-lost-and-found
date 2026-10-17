import { useMyClaims, type MyClaim } from '@/api/claims';
import { ItemList } from '@/components/item-list';
import { MyClaimCard } from '@/components/my-claim-card';
import { ThemedText } from '@/components/themed-text';

const keyOf = (claim: MyClaim) => claim.id;
const renderClaim = ({ item }: { item: MyClaim }) => <MyClaimCard claim={item} />;

export default function MyClaimsScreen() {
  const claims = useMyClaims();

  return (
    <ItemList
      items={claims.data ?? []}
      query={claims}
      keyOf={keyOf}
      renderItem={renderClaim}
      emptyText={'No claims yet. When you see your lost item in Browse, open it and tap "This is mine".'}
      header={
        <ThemedText type="subtitle" accessibilityRole="header">
          My claims
        </ThemedText>
      }
    />
  );
}
