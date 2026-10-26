import { View } from 'react-native';
import { sameName } from '@/domain/owed';
import { TextField } from '@/features/wealth/TextField';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Chip';

type Props = {
  /** "From" or "To". */
  label: string;
  /** null until chosen; '' is you. */
  value: string | null;
  people: string[];
  onChange: (name: string | null) => void;
};

/** One side of an entry: tap Me or someone in the book, or type a new name. */
export function PartyPicker({ label, value, people, onChange }: Props) {
  const typed = value !== null && value !== '' && !people.some((p) => sameName(p, value)) ? value : '';
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <AppText variant="eyebrow" tone="muted">{label}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Chip compact label={t('project.me')} accessibilityLabel={`${label}: ${t('project.me')}`} selected={value === ''} onPress={() => onChange('')} />
        {people.map((p) => (
          <Chip key={p} compact label={p} accessibilityLabel={`${label}: ${p}`} selected={value !== null && value !== '' && sameName(p, value)} onPress={() => onChange(p)} />
        ))}
      </View>
      <TextField
        hideLabel
        label={t('owed.newPerson')}
        a11yLabel={`${label}: ${t('owed.newPerson')}`}
        placeholder={t('owed.newPerson')}
        value={typed}
        onChange={(text) => onChange(text.trim() === '' ? null : text)}
        maxLength={40}
      />
    </View>
  );
}
