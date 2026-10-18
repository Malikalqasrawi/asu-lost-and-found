import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { errorMessage } from '@/api/errors';
import { useHandover, useMessages, useSendMessage, type Message } from '@/api/handovers';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { MessageBubble } from '@/components/message-bubble';
import { Note } from '@/components/note';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const keyOf = (message: Message) => message.id;
const renderMessage = ({ item }: { item: Message }) => <MessageBubble message={item} />;

export default function ChatScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const handover = useHandover(id);
  const messages = useMessages(id);
  const send = useSendMessage(id);
  const [text, setText] = useState('');
  const list = useRef<FlatList<Message>>(null);

  const failure = messages.error ?? send.error;
  const closed = Boolean(handover.data?.returnedAt);

  function submit() {
    const trimmed = text.trim();
    if (trimmed) {
      send.mutate(trimmed, { onSuccess: () => setText('') });
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={96}
      style={[styles.flex, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: handover.data?.otherPerson.firstName ?? 'Messages' }} />
      <FlatList
        ref={list}
        data={messages.data ?? []}
        keyExtractor={keyOf}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={<FormMessage message={failure ? errorMessage(failure) : null} />}
        ListEmptyComponent={
          messages.isPending ? undefined : (
            <Note text="No messages yet. Say hello and agree where to meet." />
          )
        }
      />
      {closed ? (
        <View style={styles.composer}>
          <Note text="The item was handed over, so this chat is closed." />
        </View>
      ) : (
        <View style={[styles.composer, styles.row, { borderTopColor: theme.border }]}>
          <TextInput
            accessibilityLabel="Message"
            placeholder="Write a message"
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <Button title="Send" onPress={submit} loading={send.isPending} disabled={!text.trim()} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  composer: { padding: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  input: {
    flex: 1,
    maxHeight: 120,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
});
