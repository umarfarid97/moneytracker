import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { parseStartDay } from '@/domain/budgetPeriod';
import { getLanguage } from '@/i18n/language';
import { t } from '@/i18n/t';
import { Button } from './Button';
import { Chip } from './Chip';
import { controlHeight, fontFamily, radius } from './theme';
import { sanitizeNumber } from './numeric';
import { useTheme } from './useTheme';

const PAYDAY_CHOICES = [1, 15, 25, 28, 31];
const ordinal = (n: number) => getLanguage() === 'ms' ? String(n) : `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;

/**
 * Payday chips plus a free day field. The salary day and the budget start day are one setting
 * (`profile.budgetStartDay`), so the profile and budget screens both use this picker.
 */
export function PaydayPicker({ value, onChange }: { value: number; onChange: (day: number) => void }) {
  const { c } = useTheme();
  const [dayText, setDayText] = useState(PAYDAY_CHOICES.includes(value) ? '' : String(value));
  const parsed = parseStartDay(dayText);

  function pick(day: number) {
    setDayText(PAYDAY_CHOICES.includes(day) ? '' : String(day));
    onChange(day);
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PAYDAY_CHOICES.map((day) => (
          <Chip
            key={day}
            label={day === 31 ? t('budget.startDay.last') : ordinal(day)}
            accessibilityLabel={`Budget starts ${day === 31 ? 'on the last day' : `on day ${day}`}`}
            selected={value === day}
            onPress={() => pick(day)}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          accessibilityLabel={t('budget.startDay.day')}
          value={dayText}
          onChangeText={(text) => setDayText(sanitizeNumber(text, 0))}
          keyboardType="number-pad"
          maxLength={2}
          placeholder={t('budget.startDay.day')}
          placeholderTextColor={c.muted}
          style={{
            flex: 1, minWidth: 0, height: controlHeight, borderRadius: radius.control, backgroundColor: c.surface,
            borderWidth: 1, borderColor: dayText !== '' && parsed === null ? c.negative : c.control,
            paddingHorizontal: 14, color: c.text, fontFamily: fontFamily.medium, fontSize: 16,
          }}
        />
        <Button title={t('budget.startDay.set')} variant="secondary" disabled={parsed === null || parsed === value} onPress={() => pick(parsed!)} />
      </View>
    </View>
  );
}
