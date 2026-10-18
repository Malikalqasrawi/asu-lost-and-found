import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Spacing } from '@/constants/theme';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

interface ChoiceChipsProps<T extends string> {
  choices: Choice<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
}

/** A wrapping row of chips where one can be picked. */
export function ChoiceChips<T extends string>({ choices, selected, onSelect }: ChoiceChipsProps<T>) {
  return (
    <View style={styles.wrap}>
      {choices.map((choice) => (
        <Chip
          key={choice.value}
          label={choice.label}
          selected={selected === choice.value}
          onPress={() => onSelect(choice.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
