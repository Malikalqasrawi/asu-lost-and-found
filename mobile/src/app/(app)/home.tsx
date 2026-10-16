import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Role } from '@/api/auth';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/session/session-provider';

const roleNames: Record<Exclude<Role, 'STUDENT'>, string> = {
  SECURITY: 'Security office',
  ADMIN: 'Admin',
};

export default function HomeScreen() {
  const theme = useTheme();
  const { user, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const firstName = user?.fullName.split(' ')[0] ?? '';

  return (
    <Screen title={`Hi, ${firstName}`} subtitle={user?.email}>
      {user && user.role !== 'STUDENT' ? (
        <View style={[styles.badge, { backgroundColor: theme.tint }]}>
          <ThemedText type="smallBold" style={{ color: theme.onTint }}>
            {roleNames[user.role]}
          </ThemedText>
        </View>
      ) : null}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Lost and found posts are on the way</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Soon you can post what you lost or found on campus and help items get back to their
          owners.
        </ThemedText>
      </ThemedView>
      <Button
        title="Sign out"
        variant="secondary"
        loading={signingOut}
        onPress={async () => {
          setSigningOut(true);
          await signOut();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 16,
  },
});
