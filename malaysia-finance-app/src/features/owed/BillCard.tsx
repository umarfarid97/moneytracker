import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { formatRM } from '@/domain/money';
import { billPeople, transferOf, type EntryItem } from '@/domain/owed';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Chip';
import { PressableScale } from '@/ui/PressableScale';
import { useTheme } from '@/ui/useTheme';
import { transferText, whoName } from './sentences';

type Props = {
  item: Extract<EntryItem, { type: 'bill' }>;
  onEdit: () => void;
  onDelete: () => void;
};

const capitalise = (s: string) => (s === '' ? s : s.charAt(0).toUpperCase() + s.slice(1));

/** A split bill as one row: title, a short "paid by · people" line and the total; the split and who owes what open on tap. */
export function BillCard({ item, onEdit, onDelete }: Props) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const { bill, entries } = item;
  const title = capitalise(item.note.trim()) || t('bill.untitled');
  const count = billPeople(bill);
  const payers = bill.paid.map((p) => whoName(p.name)).join(' + ');
  const subtitle = `${t('bill.paidBy', { who: payers })} · ${t('project.people.count', { count })}`;
  const split = bill.mode === 'equal'
    ? t('bill.splitEqual', { count, amount: formatRM(bill.parts[0]?.amount ?? 0) })
    : t('bill.splitBy', { mode: t(`split.mode.${bill.mode}`).toLowerCase(), count });

  return (
    <View testID="split-bill" style={{ gap: 10 }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${formatRM(bill.total)}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        pressedScale={0.99}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Ionicons name="receipt-outline" size={22} color={c.text} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>{title}</AppText>
          <AppText variant="small" tone="muted" numberOfLines={1}>{subtitle}</AppText>
        </View>
        <AppText variant="bodyStrong">{formatRM(bill.total)}</AppText>
      </PressableScale>
      {open ? (
        <View style={{ gap: 8, marginLeft: 34 }}>
          <AppText variant="small" tone="muted">{split}</AppText>
          {bill.paid.length > 1 ? (
            <AppText variant="small" tone="muted">
              {bill.paid.map((p) => `${whoName(p.name)} ${formatRM(p.amount)}`).join(' + ')}
            </AppText>
          ) : null}
          {entries.map((e) => {
            const tr = transferOf(e);
            const gain = tr.from === '' ? 1 : tr.to === '' ? -1 : 0;
            return (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <AppText variant="small" style={{ flex: 1 }}>{transferText(tr)}</AppText>
                <AppText variant="small" tone={gain > 0 ? 'positive' : gain < 0 ? 'negative' : 'muted'}>{formatRM(e.amount)}</AppText>
              </View>
            );
          })}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip compact icon="create-outline" label={t('common.edit')} accessibilityLabel={t('bill.edit')} onPress={onEdit} />
            <Chip compact icon="trash-outline" label={t('common.delete')} accessibilityLabel={t('bill.delete')} onPress={onDelete} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
