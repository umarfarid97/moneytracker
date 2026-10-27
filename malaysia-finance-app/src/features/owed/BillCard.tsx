import { useState } from 'react';
import { View } from 'react-native';
import { shortDate } from '@/domain/dates';
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

/** A split bill as one item: what it was, the total, who paid and how it was split, with the "owes" entries it produced under it. */
export function BillCard({ item, onEdit, onDelete }: Props) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const { bill, entries } = item;
  const title = item.note || t('bill.untitled');
  const count = billPeople(bill);
  const paidBy = bill.paid.map((p) => (bill.paid.length > 1 ? `${whoName(p.name)} ${formatRM(p.amount)}` : whoName(p.name))).join(' + ');
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
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="small" tone="muted">{shortDate(item.date)} · {t('bill.paidBy', { who: paidBy })}</AppText>
          <AppText variant="small" tone="muted">{split}</AppText>
        </View>
        <AppText variant="bodyStrong">{formatRM(bill.total)}</AppText>
        <AppText variant="small" tone="muted">{open ? '▴' : '▾'}</AppText>
      </PressableScale>
      {open ? (
        <View style={{ gap: 8, marginLeft: 10, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: c.border }}>
          {entries.map((e) => {
            const tr = transferOf(e);
            const gain = tr.from === '' ? 1 : tr.to === '' ? -1 : 0;
            return (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <AppText variant="small" style={{ flex: 1 }}>{transferText(tr)}</AppText>
                <AppText variant="small" tone={gain > 0 ? 'positive' : gain < 0 ? 'negative' : 'muted'}>
                  {gain > 0 ? '+' : gain < 0 ? '-' : ''}{formatRM(e.amount)}
                </AppText>
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
