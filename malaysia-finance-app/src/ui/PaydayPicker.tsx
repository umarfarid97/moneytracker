import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { Sheet } from './Sheet';
import { controlHeight, radius } from './theme';
import { useTheme } from './useTheme';

const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);
const COLUMNS = 6;

/**
 * Salary day, 1 to 31 (31 means the last day of the month). The salary day and the budget start day are one
 * setting (`profile.budgetStartDay`), so the profile and budget screens both use this picker. One row shows the
 * chosen day; tapping it opens a grid of days, and picking one saves it straight away.
 */
export function PaydayPicker({ value, onChange }: { value: number; onChange: (day: number) => void }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const label = (day: number) => (day === 31 ? t('budget.startDay.last') : t('budget.startDay.dayN', { n: day }));

  function pick(day: number) {
    setOpen(false);
    if (day !== value) onChange(day);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('profile.salaryDay')}: ${label(value)}`}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: controlHeight, borderRadius: radius.control,
          backgroundColor: c.surface, borderWidth: 1, borderColor: c.control, paddingHorizontal: 14,
        }}
      >
        <AppText variant="bodyStrong">{label(value)}</AppText>
        <Ionicons name="chevron-down" size={18} color={c.muted} />
      </Pressable>
      <Sheet visible={open} title={t('profile.salaryDay')} onClose={() => setOpen(false)}>
        <View style={{ gap: 8, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DAYS.map((day) => (
              <Cell key={day} width={`${100 / COLUMNS - 2}%`} selected={day === value} label={String(day)} a11y={`Budget starts on day ${day}`} onPress={() => pick(day)} />
            ))}
          </View>
          <Cell width="100%" selected={value === 31} label={t('budget.startDay.last')} a11y="Budget starts on the last day" onPress={() => pick(31)} />
        </View>
      </Sheet>
    </>
  );
}

function Cell({ width, selected, label, a11y, onPress }: { width: `${number}%`; selected: boolean; label: string; a11y: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        width, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center',
        backgroundColor: selected ? c.accent : c.ground, borderWidth: 1, borderColor: selected ? c.accent : c.control,
      }}
    >
      <AppText variant="bodyStrong" color={selected ? c.onAccent : c.text}>{label}</AppText>
    </Pressable>
  );
}
