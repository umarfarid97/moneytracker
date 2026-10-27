import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { brandForBill, brandForNote, type BillBrand } from '@/domain/brandLookup';
import { billEstimate, billStatus, paidDueDatesFor } from '@/domain/bills';
import { periodKey } from '@/domain/budgetPeriod';
import { dayLabel } from '@/domain/dates';
import { weekTrend } from '@/domain/homeLayout';
import { loanProgress } from '@/domain/loanTracker';
import { formatRM } from '@/domain/money';
import { buildNetWorth } from '@/domain/netWorth';
import { capReliefClaims } from '@/domain/reliefs';
import { categoryBreakdown } from '@/domain/reports';
import { progress as savingsProgress } from '@/domain/savings';
import { useAllReliefClaims } from '@/hooks/useAllReliefClaims';
import { useCategories } from '@/hooks/useCategories';
import { useCommitments } from '@/hooks/useCommitments';
import { useExpenses } from '@/hooks/useExpenses';
import { useGiving } from '@/hooks/useGiving';
import { useOwed } from '@/hooks/useOwed';
import { useProfile } from '@/hooks/useProfile';
import { useRetirement } from '@/hooks/useRetirement';
import { useSavings } from '@/hooks/useSavings';
import { useTaxYear } from '@/hooks/useTaxYear';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BarChart } from '@/ui/BarChart';
import { BrandBadge } from '@/ui/BrandBadge';
import { Card } from '@/ui/Card';
import { PressableScale } from '@/ui/PressableScale';
import { ProgressBar } from '@/ui/ProgressBar';
import { useTheme } from '@/ui/useTheme';
import { weekdayName } from '@/i18n/content';
import type { WidgetId } from '@/domain/homeLayout';

type Path = '/commitments' | '/spending' | '/savings' | '/net-worth' | '/epf' | '/owed' | '/tax' | '/zakat';

/** The white card every optional Home card sits in; tapping it opens the full screen. */
function WidgetCard({ title, path, children }: { title: string; path: Path; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={title} onPress={() => router.push(path)} pressedScale={0.99}>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="eyebrow" tone="muted">{title}</AppText>
          <Ionicons name="chevron-forward" size={18} color={c.accent} />
        </View>
        {children}
      </Card>
    </PressableScale>
  );
}

function Row({ left, right, sub, brand }: { left: string; right: string; sub?: string; brand?: BillBrand | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      {brand ? <BrandBadge {...brand} size={28} /> : null}
      <View style={{ flex: 1 }}>
        <AppText variant="body" numberOfLines={1}>{left}</AppText>
        {sub ? <AppText variant="small" tone="muted" numberOfLines={1}>{sub}</AppText> : null}
      </View>
      <AppText variant="bodyStrong">{right}</AppText>
    </View>
  );
}

const Big = ({ children }: { children: string }) => <AppText variant="kpi">{children}</AppText>;
const Note = ({ children }: { children: string }) => <AppText variant="small" tone="muted">{children}</AppText>;

function UpcomingBills() {
  const today = useToday();
  const { data: commitments } = useCommitments();
  const { data: expenses } = useExpenses();
  const rows = useMemo(() => {
    const list = commitments.map((c) => {
      const status = billStatus({ commitment: c, today, paidDueDates: paidDueDatesFor(c.id, expenses) });
      const loan = loanProgress(c, expenses, status.dueDate);
      return { c, status, done: loan?.paidOff ?? false };
    }).filter((r) => !r.done && (r.status.state === 'due' || r.status.state === 'overdue' || r.status.state === 'upcoming'));
    const rank = { overdue: 0, due: 1, upcoming: 2 } as Record<string, number>;
    return list
      .sort((a, b) => rank[a.status.state] - rank[b.status.state] || a.status.days - b.status.days)
      .slice(0, 3)
      .map((r) => ({
        id: r.c.id,
        name: r.c.name,
        brand: brandForBill(r.c.name, r.c.kind),
        amount: formatRM(billEstimate(r.c, expenses)),
        when:
          r.status.state === 'due' ? t('commitments.dueToday')
          : r.status.state === 'overdue' ? t('commitments.overdue', { days: r.status.days })
          : r.status.days === 1 ? t('commitments.dueTomorrow')
          : t('commitments.dueIn', { days: r.status.days }),
      }));
  }, [commitments, expenses, today]);
  return (
    <WidgetCard title={t('widget.upcomingBills')} path="/commitments">
      {rows.length === 0 ? <Note>{t('widgets.upcoming.none')}</Note> : rows.map((r) => <Row key={r.id} left={r.name} sub={r.when} right={r.amount} brand={r.brand} />)}
    </WidgetCard>
  );
}

function Recent() {
  const today = useToday();
  const { data: expenses } = useExpenses();
  const { data: categories } = useCategories();
  const name = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const latest = expenses.slice(0, 5);
  return (
    <WidgetCard title={t('widget.recent')} path="/spending">
      {latest.length === 0 ? <Note>{t('widgets.recent.none')}</Note> : latest.map((e) => (
        <Row key={e.id} left={e.note.trim() || name.get(e.categoryId) || ''} sub={`${name.get(e.categoryId) ?? ''} · ${dayLabel(e.date, today)}`} right={formatRM(e.amount)} brand={brandForNote(e.note)} />
      ))}
    </WidgetCard>
  );
}

function TopCategory() {
  const today = useToday();
  const { data: profile } = useProfile();
  const { data: expenses } = useExpenses();
  const { data: categories } = useCategories();
  const top = useMemo(() => {
    const startDay = profile.budgetStartDay;
    const list = categoryBreakdown(expenses, categories, periodKey(today, startDay), startDay);
    return { first: list[0] ?? null, total: list.reduce((s, x) => s + x.total, 0) };
  }, [expenses, categories, today, profile.budgetStartDay]);
  return (
    <WidgetCard title={t('widget.topCategory')} path="/spending">
      {top.first ? (
        <>
          <AppText variant="section">{top.first.name}</AppText>
          <Big>{formatRM(top.first.total)}</Big>
          <Note>{t('widgets.top.share', { percent: Math.round(top.first.share * 100), total: formatRM(top.total) })}</Note>
        </>
      ) : <Note>{t('widgets.top.none')}</Note>}
    </WidgetCard>
  );
}

function WeeklyTrend() {
  const today = useToday();
  const { data: expenses } = useExpenses();
  const week = useMemo(() => weekTrend(expenses, today), [expenses, today]);
  const diff = week.total - week.previous;
  const compare = week.previous === 0 && week.total === 0 ? null
    : diff === 0 ? t('widgets.week.same')
    : t(diff > 0 ? 'widgets.week.more' : 'widgets.week.less', { amount: formatRM(Math.abs(diff)) });
  const weekday = (date: string) => weekdayName(new Date(`${date}T00:00:00Z`).getUTCDay()).slice(0, 3);
  return (
    <WidgetCard title={t('widget.weeklyTrend')} path="/spending">
      <Big>{formatRM(week.total)}</Big>
      {compare ? <Note>{compare}</Note> : null}
      <BarChart bars={week.days.map((d) => ({ key: d.date, label: weekday(d.date), value: d.total }))} highlight={today} height={70} />
    </WidgetCard>
  );
}

function Savings() {
  const { data: accounts, totals } = useSavings();
  const goals = accounts.filter((a) => savingsProgress(a) !== null).slice(0, 2);
  const gain = totals.gain;
  return (
    <WidgetCard title={t('widget.savings')} path="/savings">
      {accounts.length === 0 ? <Note>{t('widgets.noData')}</Note> : (
        <>
          <Big>{formatRM(totals.balance)}</Big>
          {totals.invested > 0 ? <Note>{t(gain >= 0 ? 'widgets.savings.gain' : 'widgets.savings.loss', { amount: formatRM(Math.abs(gain)) })}</Note> : null}
          {goals.map((a) => {
            const fraction = savingsProgress(a) ?? 0;
            return (
              <View key={a.id} style={{ gap: 4 }}>
                <Note>{t('widgets.savings.goal', { name: a.name, percent: Math.round(fraction * 100) })}</Note>
                <ProgressBar fraction={fraction} />
              </View>
            );
          })}
        </>
      )}
    </WidgetCard>
  );
}

function NetWorthCard() {
  const year = Number(useToday().slice(0, 4));
  const { epf } = useRetirement(year);
  const { data: savings } = useSavings();
  const { data: commitments } = useCommitments();
  const { data: expenses } = useExpenses();
  const nw = useMemo(
    () => buildNetWorth({ epfBalance: epf.balance, savings, commitments, expenses }),
    [epf.balance, savings, commitments, expenses],
  );
  return (
    <WidgetCard title={t('widget.netWorth')} path="/net-worth">
      <Big>{nw.net >= 0 ? formatRM(nw.net) : `-${formatRM(-nw.net)}`}</Big>
      <Note>{`${t('widgets.netWorth.assets', { amount: formatRM(nw.totalAssets) })} · ${t('widgets.netWorth.owe', { amount: formatRM(nw.totalLiabilities) })}`}</Note>
    </WidgetCard>
  );
}

function Epf() {
  const year = Number(useToday().slice(0, 4));
  const { epf } = useRetirement(year);
  return (
    <WidgetCard title={t('widget.epf')} path="/epf">
      <Big>{formatRM(epf.balance)}</Big>
      <Note>{t('widgets.epf.year', { amount: formatRM(epf.year.employee + epf.year.employer) })}</Note>
    </WidgetCard>
  );
}

function Owed() {
  const { totals } = useOwed();
  return (
    <WidgetCard title={t('widget.owed')} path="/owed">
      <Row left={t('owed.owedToMe')} right={formatRM(totals.owedToMe)} />
      <Row left={t('owed.iOwe')} right={formatRM(totals.iOwe)} />
    </WidgetCard>
  );
}

function Loans() {
  const today = useToday();
  const { data: commitments } = useCommitments();
  const { data: expenses } = useExpenses();
  const loans = useMemo(() => {
    return commitments
      .filter((c) => c.kind === 'loan' && c.active)
      .map((c) => {
        const status = billStatus({ commitment: c, today, paidDueDates: paidDueDatesFor(c.id, expenses) });
        return { c, progress: loanProgress(c, expenses, status.dueDate) };
      })
      .filter((l) => l.progress && !l.progress.paidOff);
  }, [commitments, expenses, today]);
  const owed = loans.reduce((s, l) => s + (l.progress?.balance ?? 0), 0);
  return (
    <WidgetCard title={t('widget.loans')} path="/commitments">
      {loans.length === 0 ? <Note>{t('widgets.loans.none')}</Note> : (
        <>
          <Big>{formatRM(owed)}</Big>
          <Note>{t('widgets.loans.owed')}</Note>
          {loans.slice(0, 3).map(({ c, progress }) => (
            <View key={c.id} style={{ gap: 4 }}>
              <Row
                left={c.name}
                right={formatRM(progress!.balance)}
                sub={progress!.fraction !== null ? t('widgets.loans.paid', { percent: Math.round(progress!.fraction * 100) })
                  : progress!.left ? t('widgets.loans.left', { count: progress!.left }) : undefined}
              />
              {progress!.fraction !== null ? <ProgressBar fraction={progress!.fraction} /> : null}
            </View>
          ))}
        </>
      )}
    </WidgetCard>
  );
}

function TaxRelief() {
  const { year, data } = useTaxYear();
  const { data: claims } = useAllReliefClaims(year);
  const summary = useMemo(() => capReliefClaims(claims, data.reliefs), [claims, data]);
  const automatic = data.automaticReliefs.reduce((sum, r) => sum + r.amount, 0);
  return (
    <WidgetCard title={t('widget.taxRelief')} path="/tax">
      <Big>{formatRM(automatic + summary.total)}</Big>
      <Note>{t('widgets.tax.claimed', { year })}</Note>
    </WidgetCard>
  );
}

function Zakat() {
  const year = Number(useToday().slice(0, 4));
  const { summary } = useGiving(year);
  return (
    <WidgetCard title={t('widget.zakat')} path="/zakat">
      <Big>{formatRM(summary.total)}</Big>
      <Note>{`${t('widgets.zakat.zakat', { amount: formatRM(summary.zakat) })} · ${t('widgets.zakat.sedekah', { amount: formatRM(summary.sedekah) })}`}</Note>
    </WidgetCard>
  );
}

/** The optional cards. `today`, `balance`, `getStarted` and `categories` are drawn by the Home screen itself. */
export const OPTIONAL_WIDGETS: Partial<Record<WidgetId, () => ReactNode>> = {
  upcomingBills: () => <UpcomingBills />,
  recent: () => <Recent />,
  topCategory: () => <TopCategory />,
  weeklyTrend: () => <WeeklyTrend />,
  savings: () => <Savings />,
  netWorth: () => <NetWorthCard />,
  epf: () => <Epf />,
  owed: () => <Owed />,
  loans: () => <Loans />,
  taxRelief: () => <TaxRelief />,
  zakat: () => <Zakat />,
};
