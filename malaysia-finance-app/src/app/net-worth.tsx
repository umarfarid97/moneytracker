import { View } from 'react-native';
import { formatRM } from '@/domain/money';
import { buildNetWorth, type NetWorthLine } from '@/domain/netWorth';
import { useCommitments } from '@/hooks/useCommitments';
import { useExpenses } from '@/hooks/useExpenses';
import { useRetirement } from '@/hooks/useRetirement';
import { useSavings } from '@/hooks/useSavings';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Card } from '@/ui/Card';
import { HeroCard } from '@/ui/HeroCard';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';

export default function NetWorth() {
  const { c } = useTheme();
  const year = Number(useToday().slice(0, 4));
  const { epf } = useRetirement(year);
  const { data: savings } = useSavings();
  const { data: commitments } = useCommitments();
  const { data: expenses } = useExpenses();
  const nw = buildNetWorth({ epfBalance: epf.balance, savings, commitments, expenses });

  const group = (title: string, lines: NetWorthLine[], total: number, empty: string, negative = false) => (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="bodyStrong" color={negative ? c.negative : c.positive}>{formatRM(total)}</AppText>
      </View>
      {lines.length === 0 ? <AppText variant="small" tone="muted">{empty}</AppText> : null}
      {lines.map((l) => (
        <View key={l.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <AppText style={{ flex: 1 }}>{l.name}</AppText>
          <AppText variant="bodyStrong">{negative ? `-${formatRM(l.amount)}` : formatRM(l.amount)}</AppText>
        </View>
      ))}
    </Card>
  );

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('netWorth.title')}</AppText>
      <HeroCard style={{ gap: 4 }}>
        <AppText variant="eyebrow" color={c.heroSoft}>{t('netWorth.title')}</AppText>
        <AppText testID="net-worth" variant="kpi" color={c.heroInk}>{formatRM(nw.net)}</AppText>
        <AppText variant="small" tone="muted">{t('netWorth.hint')}</AppText>
        {savings.length === 0 && nw.totalLiabilities > nw.totalAssets ? (
          <AppText variant="small" tone="muted">{t('netWorth.addAssets')}</AppText>
        ) : null}
      </HeroCard>
      {group(t('netWorth.assets'), nw.assets, nw.totalAssets, t('netWorth.noAssets'))}
      {group(t('netWorth.liabilities'), nw.liabilities, nw.totalLiabilities, t('netWorth.noLoans'), true)}
      {nw.untrackedLoans > 0 ? (
        <AppText variant="small" tone="muted">{t('netWorth.untracked', { count: nw.untrackedLoans })}</AppText>
      ) : null}
    </Screen>
  );
}
