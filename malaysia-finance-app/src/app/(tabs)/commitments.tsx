import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { daysUntil, monthlyCommitmentTotal, nextDueDate } from '@/domain/commitments';
import { formatRM } from '@/domain/money';
import type { Commitment } from '@/domain/types';
import { CommitmentSheet } from '@/features/commitments/CommitmentSheet';
import { useCommitments } from '@/hooks/useCommitments';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

function dueLabel(days: number): string {
  if (days === 0) return t('commitments.dueToday');
  if (days === 1) return t('commitments.dueTomorrow');
  return t('commitments.dueIn', { days });
}

type SheetState = { open: boolean; editing: Commitment | null; nonce: number };

export default function Commitments() {
  const { c } = useTheme();
  const today = useToday();
  const { data, add, update, remove } = useCommitments();
  const [sheet, setSheet] = useState<SheetState>({ open: false, editing: null, nonce: 0 });

  const rows = useMemo(() => {
    const withDays = data.map((item) => ({
      item,
      days: daysUntil(nextDueDate(item.dayOfMonth, today), today),
    }));
    return withDays.sort((a, b) => {
      if (a.item.active !== b.item.active) return a.item.active ? -1 : 1;
      return a.days - b.days || a.item.name.localeCompare(b.item.name);
    });
  }, [data, today]);

  const openSheet = (editing: Commitment | null) =>
    setSheet((s) => ({ open: true, editing, nonce: s.nonce + 1 }));
  const closeSheet = () => setSheet((s) => ({ ...s, open: false }));

  return (
    <Screen fab>
      <AppText variant="title">{t('commitments.title')}</AppText>
      <Card style={{ gap: 4 }}>
        <AppText variant="small" tone="muted">
          {t('commitments.total')}
        </AppText>
        <AppText testID="commitments-total" variant="kpi">
          {formatRM(monthlyCommitmentTotal(data))}
        </AppText>
      </Card>
      <Button title={t('commitments.add')} onPress={() => openSheet(null)} />
      {rows.length === 0 ? (
        <AppText variant="body" tone="muted" style={{ textAlign: 'center', marginTop: 16 }}>
          {t('commitments.none')}
        </AppText>
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map(({ item, days }) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => item.id > 0 && openSheet(item)}
              style={{
                backgroundColor: c.surface,
                borderRadius: radius.control,
                paddingHorizontal: 16,
                minHeight: 68,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                opacity: item.active ? 1 : 0.6,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText testID="commitment-name" variant="bodyStrong" numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="small" tone="muted">
                  {item.active ? dueLabel(days) : t('commitments.paused')}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <AppText variant="bodyStrong">{formatRM(item.amount)}</AppText>
                <AppText variant="small" tone="muted">
                  {t(`commitments.kind.${item.kind}`)}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <CommitmentSheet
        key={sheet.nonce}
        visible={sheet.open}
        existing={sheet.editing}
        onClose={closeSheet}
        onSave={async (input) => {
          if (sheet.editing) await update({ ...sheet.editing, ...input });
          else await add(input);
        }}
        onDelete={sheet.editing ? () => remove(sheet.editing!.id) : undefined}
      />
    </Screen>
  );
}
