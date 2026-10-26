import { View } from 'react-native';
import { NO_EVENT, sameName } from '@/domain/owed';
import { TextField } from '@/features/wealth/TextField';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Chip';

type Props = {
  value: string;
  onChange: (event: string) => void;
  /** Events used before, offered as chips. */
  events: string[];
};

/** Pick the event something belongs to: no event, one used before, or a new name typed in. */
export function EventPicker({ value, onChange, events }: Props) {
  const typedNew = value !== NO_EVENT && !events.some((e) => sameName(e, value));
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="eyebrow" tone="muted">{t('owed.event')}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip compact label={t('owed.noEvent')} selected={value === NO_EVENT} onPress={() => onChange(NO_EVENT)} />
        {events.map((e) => (
          <Chip key={e} compact label={e} selected={sameName(e, value)} onPress={() => onChange(e)} />
        ))}
      </View>
      <TextField
        label={t('owed.eventNew')}
        value={typedNew ? value : ''}
        onChange={(text) => onChange(text === '' ? NO_EVENT : text)}
        placeholder={t('owed.eventPlaceholder')}
        maxLength={40}
      />
    </View>
  );
}
