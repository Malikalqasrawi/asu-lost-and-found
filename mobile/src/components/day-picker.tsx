import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';

import { ChoiceChips } from '@/components/choice-chips';
import { daysAgo, formatDay, localIsoDate } from '@/constants/labels';

interface DayPickerProps {
  value: string;
  onChange: (day: string) => void;
}

const EARLIER = 'earlier';

/** Today, yesterday or an earlier day from the calendar, as YYYY-MM-DD. */
export function DayPicker({ value, onChange }: DayPickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const today = daysAgo(0);
  const yesterday = daysAgo(1);
  const earlier = value !== today && value !== yesterday;

  return (
    <>
      <ChoiceChips
        choices={[
          { value: today, label: 'Today' },
          { value: yesterday, label: 'Yesterday' },
          { value: EARLIER, label: earlier ? formatDay(value) : 'Earlier' },
        ]}
        selected={earlier ? EARLIER : value}
        onSelect={(choice) => (choice === EARLIER ? setShowCalendar(true) : onChange(choice))}
      />
      {showCalendar ? (
        <DateTimePicker
          value={new Date(`${value}T12:00:00`)}
          mode="date"
          maximumDate={new Date()}
          onChange={(_event, picked) => {
            setShowCalendar(false);
            if (picked) {
              onChange(localIsoDate(picked));
            }
          }}
        />
      ) : null}
    </>
  );
}
