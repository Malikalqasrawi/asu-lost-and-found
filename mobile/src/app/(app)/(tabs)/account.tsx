import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Role } from '@/api/auth';
import { Button } from '@/components/button';
import { ChoiceChips, type Choice } from '@/components/choice-chips';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { setAppearance, useAppearance, type AppearanceChoice } from '@/hooks/use-appearance';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/session/session-provider';

const roleNames: Record<Role, string> = {
  STUDENT: 'Student',
  SECURITY: 'Security office',
  ADMIN: 'Admin',
};

const appearances: Choice<AppearanceChoice>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function AccountScreen() {
  const theme = useTheme();
  const appearance = useAppearance();
  const router = useRouter();
  const { user, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Screen title={user?.fullName ?? 'Account'} subtitle={user?.email}>
      {user ? (
        <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{roleNames[user.role]}</ThemedText>
        </View>
      ) : null}
      <View style={styles.section}>
        <ThemedText type="smallBold">Appearance</ThemedText>
        <ChoiceChips
          choices={appearances}
          selected={appearance}
          onSelect={(choice) => void setAppearance(choice)}
        />
      </View>
      <Button
        title="Change email"
        variant="secondary"
        onPress={() => router.push('/account/change-email')}
      />
      <Button
        title="Sign out"
        variant="secondary"
        loading={signingOut}
        onPress={async () => {
          setSigningOut(true);
          await signOut();
        }}
      />
      <Button
        title="Delete account"
        variant="link"
        onPress={() => router.push('/account/delete')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
