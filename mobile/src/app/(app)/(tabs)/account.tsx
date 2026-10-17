import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Role } from '@/api/auth';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/session/session-provider';

const roleNames: Record<Role, string> = {
  STUDENT: 'Student',
  SECURITY: 'Security office',
  ADMIN: 'Admin',
};

export default function AccountScreen() {
  const theme = useTheme();
  const { user, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Screen title={user?.fullName ?? 'Account'} subtitle={user?.email}>
      {user ? (
        <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{roleNames[user.role]}</ThemedText>
        </View>
      ) : null}
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
});
