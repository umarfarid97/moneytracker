import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import {
  applyBillChange, billEstimate, billStatus, lastPaidFor, paidDueDatesFor, payMode, type BillState, type BillStatus,
} from '@/domain/bills';
import { brandForBill } from '@/domain/brandLookup';
import { longDate, monthLabel, shortDate } from '@/domain/dates';
import {
  activeMonthly, instalmentNumber, isPaidOff, loanBalance, loanProgress, nextPayment, totalOwed, type LoanProgress,
} from '@/domain/loanTracker';
import { formatRM } from '@/domain/money';
import type { Commitment, CommitmentKind } from '@/domain/types';
import { CommitmentSheet } from '@/features/commitments/CommitmentSheet';
import { MarkPaidSheet } from '@/features/commitments/MarkPaidSheet';
import { useData } from '@/hooks/DataProvider';
import { useCommitments } from '@/hooks/useCommitments';
import { useExpenses } from '@/hooks/useExpenses';
import { useShowPending } from '@/hooks/useShowPending';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BrandBadge } from '@/ui/BrandBadge';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { HeroCard } from '@/ui/HeroCard';
import { IconBadge } from '@/ui/IconBadge';
import { confirmDelete } from '@/ui/confirm';
import { PressableScale } from '@/ui/PressableScale';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { elevation, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { Toggle } from '@/ui/Toggle';

const LOAN_ICON = { home: 'home', car: 'car', ptptn: 'school', personal: 'cash', bnpl: 'card', installment: 'receipt' } as const;

const KIND_LOOK: Record<CommitmentKind, { icon: 'flash' | 'business' | 'repeat'; color: string }> = {
  bill: { icon: 'flash', color: '#d97706' },
  loan: { icon: 'business', color: '#4f46e5' },
  subscription: { icon: 'repeat', color: '#db2777' },
};

const KINDS: CommitmentKind[] = ['bill', 'loan', 'subscription'];

const RANK: Record<BillState, number> = { overdue: 0, due: 1, upcoming: 2, paid: 3, paused: 4, ended: 5 };

/** The brand mark for a biller or pay later provider, or null to use the plain icon of its kind. */
function brandOf(item: Commitment) {
  return brandForBill(item.name, item.kind, item.loanType);
}

function loanLine(p: LoanProgress): string {
  const parts = [t('loans.owed', { amount: formatRM(p.balance) })];
  if (p.left === null) parts.push(t('loans.never'));
  else {
    parts.push(p.left === 1 ? t('loans.left1') : t('loans.left', { count: p.left }));
    if (p.payoffDate) parts.push(t('loans.finish', { date: monthLabel(p.payoffDate.slice(0, 7)) }));
  }
  return parts.join(' · ');
}

function statusLabel(s: BillStatus): string {
  switch (s.state) {
    case 'due':
      return t('commitments.dueToday');
    case 'overdue':
      return s.days === 1 ? t('commitments.overdue1') : t('commitments.overdue', { days: s.days });
    case 'paused':
      return t('commitments.paused');
    case 'ended':
      return t('commitments.ended');
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
  const { payBill, profile } = useData();
  const startDay = profile.budgetStartDay;
  const { data, add, update, remove } = useCommitments();
  const { data: expenses, remove: removeExpense } = useExpenses();
  const [showPending, setShowPending] = useShowPending();
  const [justPaid, setJustPaid] = useState<{ id: number; name: string } | null>(null);
  const [sheet, setSheet] = useState<SheetState>({ open: false, editing: null, nonce: 0 });
  const [filter, setFilter] = useState<CommitmentKind | 'all'>('all');
  const [pay, setPay] = useState<PaySheet>({ open: false, bill: null, dueDate: today, nonce: 0 });

  const rows = useMemo(() => {
    const withStatus = data.map((item) => {
      const base = billStatus({ commitment: item, today, paidDueDates: paidDueDatesFor(item.id, expenses) });
      const loan = loanProgress(item, expenses, base.dueDate);
      // A loan with nothing left to pay stops being due; it sits at the bottom as paid off.
      const status: BillStatus = loan?.paidOff && item.active ? { ...base, state: 'paused' } : base;
      return { item, status, loan };
    });
    return withStatus.sort((a, b) => {
      const byState = RANK[a.status.state] - RANK[b.status.state];
      if (byState !== 0) return byState;
      const byDays = a.status.state === 'overdue' ? b.status.days - a.status.days : a.status.days - b.status.days;
      return byDays || a.item.name.localeCompare(b.item.name);
    });
  }, [data, expenses, today]);

  const total = useMemo(
    () => activeMonthly(data, expenses, (item) => billEstimate(item, expenses)),
    [data, expenses],
  );
  const byKind = useMemo(
    () => KINDS.map((kind) => {
      const list = data.filter((item) => item.kind === kind);
      return {
        kind,
        rows: rows.filter((r) => r.item.kind === kind),
        count: list.length,
        total: activeMonthly(list, expenses, (item) => billEstimate(item, expenses)),
      };
    }),
    [data, rows, expenses],
  );
  const owed = useMemo(() => totalOwed(data, expenses), [data, expenses]);
  const anyVariable = data.some((item) => item.active && item.variable);

  const openSheet = (editing: Commitment | null) =>
    setSheet((s) => ({ open: true, editing, nonce: s.nonce + 1 }));
  const closeSheet = () => setSheet((s) => ({ ...s, open: false }));
  const openPay = (bill: Commitment, dueDate: string) =>
    setPay((p) => ({ open: true, bill, dueDate, nonce: p.nonce + 1 }));
  const closePay = () => setPay((p) => ({ ...p, open: false }));

  const renderRow = ({ item, status, loan }: (typeof rows)[number]): ReactNode => {
            const mode = payMode({ commitment: item, status, today, startDay });
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
                {brandOf(item) ? (
                  <BrandBadge {...brandOf(item)!} size={42} testID={`brand-${brandOf(item)!.id}`} />
                ) : (
                  <IconBadge icon={item.kind === 'loan' ? LOAN_ICON[item.loanType ?? 'personal'] : KIND_LOOK[item.kind].icon} color={KIND_LOOK[item.kind].color} size={42} />
                )}
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
                    {loan?.paidOff
                      ? t('loans.paidOff')
                      : item.variable
                        ? `${statusLabel(status)} · ${t('commitments.varies')}`
                        : `${statusLabel(status)}${loan ? ` · ${shortDate(status.dueDate)}` : ''}`}
                  </AppText>
                  {item.startsOn !== null && item.startsOn > today ? (
                    <AppText variant="small" tone="muted">{t('bill.starts', { date: longDate(item.startsOn) })}</AppText>
                  ) : null}
                  {item.endsOn !== null ? (
                    <AppText variant="small" tone="muted">{t('bill.ends', { date: longDate(item.endsOn) })}</AppText>
                  ) : null}
                  {item.kind === 'loan' && instalmentNumber(item, today) !== null ? (
                    <AppText testID="loan-instalment" variant="small" tone="muted">{t('loans.instalmentNo', { n: instalmentNumber(item, today)! })}</AppText>
                  ) : null}
                  {loan && !loan.paidOff ? (
                    <View style={{ gap: 4 }}>
                      <AppText testID="loan-line" variant="small" tone="muted">{loanLine(loan)}</AppText>
                      {loan.fraction !== null ? <ProgressBar fraction={loan.fraction} /> : null}
                    </View>
                  ) : null}
                </Pressable>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <AppText variant="bodyStrong">
                    {item.variable ? `~${formatRM(billEstimate(item, expenses))}` : formatRM(item.amount)}
                  </AppText>
                  {mode === 'now' && item.id > 0 ? (
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
                  ) : mode === 'wait' ? (
                    <AppText variant="small" tone="muted">
                      {t(item.startsOn !== null && item.startsOn > today ? 'commitments.startsOn' : 'commitments.dueOn', { date: shortDate(status.dueDate) })}
                    </AppText>
                  ) : (
                    <AppText variant="small" tone="muted">
                      {t(`commitments.kind.${item.kind}`)}
                    </AppText>
                  )}
                </View>
              </View>
            );
  };

  return (
    <Screen fab>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <AppText variant="title" style={{ flexShrink: 1 }}>{t('commitments.title')}</AppText>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('commitments.add')}
          hitSlop={8}
          onPress={() => openSheet(null)}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={22} color={c.accentInk} />
        </PressableScale>
      </View>
      <HeroCard hero="mint" style={{ gap: 6 }}>
        <AppText variant="eyebrow" color={c.heroSoft}>
          {t('commitments.total')}
        </AppText>
        <AppText testID="commitments-total" variant="kpi" color={c.heroInk} style={{ fontSize: 40, lineHeight: 48 }}>
          {formatRM(total)}
        </AppText>
        {anyVariable ? (
          <AppText variant="small" color={c.heroSoft}>
            {t('commitments.totalHint')}
          </AppText>
        ) : null}
        {owed > 0 ? (
          <AppText testID="loans-owed" variant="smallStrong" color={c.heroSoft}>
            {`${t('loans.totalOwed')} ${formatRM(owed)}`}
          </AppText>
        ) : null}
      </HeroCard>
      {justPaid ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: c.accentSoft, borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 10 }}>
          <AppText variant="smallStrong" color={c.accentInk} style={{ flex: 1 }}>{t('commitments.justPaid', { name: justPaid.name })}</AppText>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('commitments.undo')}
            hitSlop={8}
            onPress={() => {
              removeExpense(justPaid.id).catch(() => {});
              setJustPaid(null);
            }}
          >
            <AppText variant="bodyStrong" color={c.accent}>{t('commitments.undo')}</AppText>
          </PressableScale>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip compact label={t('commitments.filter.all')} selected={filter === 'all'} onPress={() => setFilter('all')} />
        {KINDS.map((kind) => (
          <Chip key={kind} compact label={t(`commitments.group.${kind}`)} selected={filter === kind} onPress={() => setFilter(kind)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <AppText variant="small" tone="muted" style={{ flex: 1 }}>{t('commitments.showPending')}</AppText>
        <Toggle accessibilityLabel={t('commitments.showPending')} value={showPending} onValueChange={setShowPending} />
      </View>
      {rows.length === 0 ? (
        <EmptyState icon="calendar-outline" text={t('commitments.none')} hint={t('commitments.noneHint')} />
      ) : (
        <View style={{ gap: 16 }}>
          {byKind.filter((g) => filter === 'all' || g.kind === filter).map((g) => (
            <View key={g.kind} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <AppText variant="section" testID={`group-${g.kind}`}>{t(`commitments.group.${g.kind}`)}</AppText>
                {g.count > 0 ? (
                  <AppText variant="smallStrong" tone="muted" testID={`group-total-${g.kind}`}>{formatRM(g.total)}</AppText>
                ) : null}
              </View>
              {g.rows.length === 0 ? (
                <AppText variant="small" tone="muted">{t(`commitments.group.none.${g.kind}`)}</AppText>
              ) : (
                g.rows.map((r) => <View key={r.item.id}>{renderRow(r)}</View>)
              )}
            </View>
          ))}
        </View>
      )}
      <CommitmentSheet
        key={`edit-${sheet.nonce}`}
        visible={sheet.open}
        existing={sheet.editing}
        currentBalance={sheet.editing ? loanBalance(sheet.editing, expenses) : null}
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
        lastPaid={pay.bill ? lastPaidFor(pay.bill.id, expenses) : null}
        suggested={pay.bill ? nextPayment(pay.bill, loanBalance(pay.bill, expenses)) : null}
        today={today}
        startDay={startDay}
        onClose={closePay}
        onConfirm={async (amount, date, paymentMethodId) => {
          if (!pay.bill) return;
          const saved = await payBill(pay.bill, pay.dueDate, { amount, date, paymentMethodId });
          if (saved) setJustPaid({ id: saved.id, name: pay.bill.name });
        }}
      />
    </Screen>
  );
}
