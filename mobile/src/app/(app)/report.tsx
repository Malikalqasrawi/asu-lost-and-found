import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useSendReport, type ReportReason, type ReportTarget } from '@/api/reports';
import { Button } from '@/components/button';
import { ChoiceChips, type Choice } from '@/components/choice-chips';
import { FormMessage } from '@/components/form-message';
import { Note } from '@/components/note';
import { TextField } from '@/components/text-field';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const reasons: Choice<ReportReason>[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'FAKE', label: 'Fake or misleading' },
  { value: 'OFFENSIVE', label: 'Offensive' },
  { value: 'PERSONAL_DETAILS', label: 'Shows personal details' },
  { value: 'OTHER', label: 'Something else' },
];

type Params = { post?: string; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The ids come from the link that opened this screen, so only real ids count. */
function targetFrom({ post, message }: Params): ReportTarget | null {
  if (post && UUID.test(post)) {
    return { kind: 'post', id: post };
  }
  return message && UUID.test(message) ? { kind: 'message', id: message } : null;
}

function Page({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

function ReportForm({ target }: { target: ReportTarget }) {
  const router = useRouter();
  const send = useSendReport(target);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [missingReason, setMissingReason] = useState(false);

  function submit() {
    if (!reason) {
      setMissingReason(true);
      return;
    }
    send.mutate({ reason, details: details.trim() });
  }

  if (send.isSuccess) {
    return (
      <Page>
        <FormMessage tone="info" message="Thanks for telling us. A moderator will look at it." />
        <Button title="Done" onPress={() => router.back()} />
      </Page>
    );
  }

  return (
    <Page>
      <Note
        text={`What is wrong with this ${target.kind}? The student doesn't learn who reported it.`}
      />
      <ChoiceChips choices={reasons} selected={reason} onSelect={setReason} />
      <FormMessage message={missingReason && !reason ? 'Choose a reason.' : null} />
      <TextField
        label="More details (optional)"
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={500}
        style={styles.multiline}
      />
      <FormMessage message={send.isError ? errorMessage(send.error) : null} />
      <Button title="Send report" onPress={submit} loading={send.isPending} />
    </Page>
  );
}

/** Report a post (?post=id) or a chat message (?message=id) to the moderators. */
export default function ReportScreen() {
  const target = targetFrom(useLocalSearchParams<Params>());

  if (!target) {
    return (
      <Page>
        <FormMessage message="There is nothing to report here." />
      </Page>
    );
  }
  return <ReportForm target={target} />;
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxFormWidth,
    width: '100%',
    alignSelf: 'center',
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
