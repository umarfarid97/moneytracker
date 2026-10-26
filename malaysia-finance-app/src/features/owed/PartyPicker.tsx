import { View } from 'react-native';
import { sameName } from '@/domain/owed';
import { TextField } from '@/features/wealth/TextField';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Chip';

type Props = {
  label: string;
  /** null until chosen; '' is you. */
  value: string | null;
  people: string[];
  onChange: (name: string | null) => void;
};

/** Pick one person in the book (or yourself), or type someone new. */
export function PartyPicker({ label, value, people, onChange }: Props) {
  const typed = value !== null && value !== '' && !people.some((p) => sameName(p, value)) ? value : '';
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="eyebrow" tone="muted">{label}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip compact label={t('project.me')} accessibilityLabel={`${label}: ${t('project.me')}`} selected={value === ''} onPress={() => onChange('')} />
        {people.map((p) => (
          <Chip key={p} compact label={p} accessibilityLabel={`${label}: ${p}`} selected={value !== null && value !== '' && sameName(p, value)} onPress={() => onChange(p)} />
        ))}
      </View>
      <TextField label={t('owed.newPerson')} a11yLabel={`${label}: ${t('owed.newPerson')}`} value={typed} onChange={(text) => onChange(text.trim() === '' ? null : text)} maxLength={40} />
    </View>
  );
}
