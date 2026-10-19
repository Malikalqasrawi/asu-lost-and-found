import { StyleSheet, View } from 'react-native';

import { useSendConfirmationCode, type IdentityProof } from '@/api/account';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Note } from '@/components/note';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';

export interface IdentityValue {
  password: string;
  code: string;
}

export const noIdentity: IdentityValue = { password: '', code: '' };

/** What the server gets as proof, or null when nothing was typed yet. */
export function proofFrom(hasPassword: boolean, value: IdentityValue): IdentityProof | null {
  if (hasPassword) {
    return value.password ? { password: value.password } : null;
  }
  const code = value.code.replace(/\s/g, '');
  return code ? { code } : null;
}

interface IdentityFieldsProps {
  hasPassword: boolean;
  value: IdentityValue;
  onChange: (value: IdentityValue) => void;
}

/** Asks for the password, or emails a code to accounts that sign in with Microsoft only. */
export function IdentityFields({ hasPassword, value, onChange }: IdentityFieldsProps) {
  const sendCode = useSendConfirmationCode();

  if (hasPassword) {
    return (
      <TextField
        label="Your password"
        value={value.password}
        onChangeText={(password) => onChange({ ...value, password })}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
    );
  }

  return (
    <View style={styles.box}>
      <Note text="Your account signs in with Microsoft, so we email you a code instead of asking for a password." />
      <FormMessage message={sendCode.isError ? errorMessage(sendCode.error) : null} />
      {sendCode.isSuccess ? (
        <FormMessage tone="info" message="We emailed you a 6-digit code." />
      ) : null}
      <Button
        title={sendCode.isSuccess ? 'Email me another code' : 'Email me a code'}
        variant="secondary"
        loading={sendCode.isPending}
        onPress={() => sendCode.mutate()}
      />
      <TextField
        label="Code from the email"
        value={value.code}
        onChangeText={(code) => onChange({ ...value, code })}
        keyboardType="number-pad"
        maxLength={7}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.three },
});
