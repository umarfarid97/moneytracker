import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { applyBillChange, billStatus, paidDueDatesFor, type BillState, type BillStatus } from '@/domain/bills';
import { monthlyCommitmentTotal } from '@/domain/commitments';
import { formatRM } from '@/domain/money';
import type { Commitment, CommitmentKind } from '@/domain/types';
import { CommitmentSheet } from '@/features/commitments/CommitmentSheet';
import { MarkPaidSheet } from '@/features/commitments/MarkPaidSheet';
import { useData } from '@/hooks/DataProvider';
import { useCommitments } from '@/hooks/useCommitments';
import { useExpenses } from '@/hooks/useExpenses';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { IconBadge } from '@/ui/IconBadge';
import { confirmDelete } from '@/ui/confirm';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { elevation, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const KIND_LOOK: Record<CommitmentKind, { icon: 'flash' | 'business' | 'repeat'; color: string }> = {
  bill: { icon: 'flash', color: '#d97706' },
  loan: { icon: 'business', color: '#4f46e5' },
  subscription: { icon: 'repeat', color: '#db2777' },
};

const RANK: Record<BillState, number> = { overdue: 0, due: 1, upcoming: 2, paid: 3, paused: 4 };

function statusLabel(s: BillStatus): string {
  switch (s.state) {
    case 'due':
      return t('commitments.dueToday');
    case 'overdue':
      return s.days === 1 ? t('commitments.overdue1') : t('commitments.overdue', { days: s.days });
    case 'paused':
      return t('commitments.paused');
    case 'paid':
      return s.days === 1 ? t('commitments.paidNextTomorrow') : t('commitments.paidNext', { days: s.days });
    default:
      return s.days === 1 ? t('commitments.dueTomorrow') : t('commitments.dueIn', { days: s.days });
  }
}

type SheetState = { open: boolean; editing: Commitment | null; nonce: number };
type PaySheet = { open: boolean; bill: Commitment | null; dueDate: string; nonce: number };

export default function Commitments() {
  const { c, scheme } = useTheme();
  const today = useToday();
  const { payBill } = useData();
  const { data, add, update, remove } = useCommitments();
  const { data: expenses } = useExpenses();
  const [sheet, setSheet] = useState<SheetState>({ open: false, editing: null, nonce: 0 });
  const [pay, setPay] = useState<PaySheet>({ open: false, bill: null, dueDate: today, nonce: 0 });

  const rows = useMemo(() => {
    const withStatus = data.map((item) => ({
      item,
      status: billStatus({ commitment: item, today, paidDueDates: paidDueDatesFor(item.id, expenses) }),
    }));
    return withStatus.sort((a, b) => {
      const byState = RANK[a.status.state] - RANK[b.status.state];
      if (byState !== 0) return byState;
      const byDays = a.status.state === 'overdue' ? b.status.days - a.status.days : a.status.days - b.status.days;
      return byDays || a.item.name.localeCompare(b.item.name);
    });
  }, [data, expenses, today]);

  const openSheet = (editing: Commitment | null) =>
    setSheet((s) => ({ open: true, editing, nonce: s.nonce + 1 }));
  const closeSheet = () => setSheet((s) => ({ ...s, open: false }));
  const openPay = (bill: Commitment, dueDate: string) =>
    setPay((p) => ({ open: true, bill, dueDate, nonce: p.nonce + 1 }));
  const closePay = () => setPay((p) => ({ ...p, open: false }));

  return (
    <Screen fab>
      <AppText variant="title">{t('commitments.title')}</AppText>
      <HeroCard hero="mint" style={{ gap: 6 }}>
        <AppText variant="eyebrow" color={onHero.soft}>
          {t('commitments.total')}
        </AppText>
        <AppText testID="commitments-total" variant="kpi" color={onHero.ink} style={{ fontSize: 40, lineHeight: 48 }}>
          {formatRM(monthlyCommitmentTotal(data))}
        </AppText>
      </HeroCard>
      <Button title={t('commitments.add')} onPress={() => openSheet(null)} />
      {rows.length === 0 ? (
        <EmptyState icon="calendar-outline" text={t('commitments.none')} />
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map(({ item, status }) => {
            const payable = status.state === 'due' || status.state === 'overdue' || status.state === 'upcoming';
            const late = status.state === 'overdue';
            return (
              <View
                key={item.id}
                style={[{
                  backgroundColor: c.surface,
                  borderRadius: radius.control + 2,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  minHeight: 68,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  opacity: item.active ? 1 : 0.6,
                }, elevation(scheme)]}
              >
                <IconBadge icon={KIND_LOOK[item.kind].icon} color={KIND_LOOK[item.kind].color} size={42} />
                {/* The row and the Mark paid action are siblings: buttons must not be nested. */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => item.id > 0 && openSheet(item)}
                  style={{ flex: 1, gap: 2 }}
                >
                  <AppText testID="commitment-name" variant="bodyStrong" numberOfLines={1}>
                    {item.name}
                  </AppText>
                  <AppText variant="small" tone={late ? 'negative' : 'muted'}>
                    {statusLabel(status)}
                  </AppText>
                </Pressable>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <AppText variant="bodyStrong">{formatRM(item.amount)}</AppText>
                  {payable && item.id > 0 ? (
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`${t('commitments.markPaid')} ${item.name}`}
                      hitSlop={8}
                      onPress={() => openPay(item, status.dueDate)}
                      style={{ backgroundColor: c.accentSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4, marginTop: 2 }}
                    >
                      <AppText variant="smallStrong" color={c.accentInk}>
                        {t('commitments.markPaid')}
                      </AppText>
                    </PressableScale>
                  ) : (
                    <AppText variant="small" tone="muted">
                      {t(`commitments.kind.${item.kind}`)}
                    </AppText>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
      <CommitmentSheet
        key={`edit-${sheet.nonce}`}
        visible={sheet.open}
        existing={sheet.editing}
        onClose={closeSheet}
        onSave={async (input) => {
          if (sheet.editing) await update(applyBillChange(sheet.editing, { ...sheet.editing, ...input }, today));
          else await add(input);
        }}
        onDelete={sheet.editing ? async () => {
          const bill = sheet.editing!;
          const ok = await confirmDelete(
            t('confirm.deleteBill'), t('confirm.deleteBillBody', { name: bill.name }), t('common.delete'), t('common.cancel'),
          );
          if (ok) await remove(bill.id);
          return ok;
        } : undefined}
      />
      <MarkPaidSheet
        key={`pay-${pay.nonce}`}
        visible={pay.open}
        bill={pay.bill}
        onClose={closePay}
        onConfirm={async (amount) => {
          if (pay.bill) await payBill(pay.bill, pay.dueDate, { amount, date: today });
        }}
      />
    </Screen>
  );
}
