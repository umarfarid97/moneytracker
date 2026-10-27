import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { periodKey } from '@/domain/budgetPeriod';
import { balanceLeft } from '@/domain/balance';
import { buildHome } from '@/domain/summary';
import { shortDate } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useCommitments } from '@/hooks/useCommitments';
import { useExpenses } from '@/hooks/useExpenses';
import { useData } from '@/hooks/DataProvider';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { GET_STARTED_MAX_SPENDINGS, GetStarted } from '@/features/onboarding/GetStarted';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { Screen } from '@/ui/Screen';
import { radius } from '@/ui/theme';
import { Tile } from '@/ui/Tile';
import { TileGrid } from '@/ui/TileGrid';

export default function Home() {
  const today = useToday();
  const { data: expenses } = useExpenses();
  const { data: categories } = useCategories();
  const { data: profile } = useProfile();
  const { data: commitments } = useCommitments();
  const { incomeEntries } = useData();
  const startDay = profile.budgetStartDay;
  const { data: budgets } = useBudgets(periodKey(today, startDay));
  const home = useMemo(
    () => buildHome({ categories, expenses, budgets, today, startDay }),
    [categories, expenses, budgets, today, startDay],
  );
  const balance = useMemo(
    () => balanceLeft({ profile, expenses, commitments, today, extraIncome: incomeEntries }),
    [profile, expenses, commitments, today, incomeEntries],
  );
  const categoryById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);

  return (
    <Screen fab>
      <AppText variant="title">{shortDate(today)}</AppText>
      <HeroCard style={{ gap: 6 }}>
        <AppText variant="eyebrow" color={onHero.soft}>
          {t('home.today')}
        </AppText>
        <AppText variant="kpi" color={onHero.ink} style={{ fontSize: 40, lineHeight: 48 }}>
          {formatRM(home.todaySpent)}
        </AppText>
        {home.today ? (
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: onHero.chip, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, marginTop: 4 }}>
            <Ionicons name={home.today.left >= 0 ? 'checkmark-circle' : 'information-circle'} size={16} color={onHero.ink} />
            <AppText variant="smallStrong" color={onHero.ink}>
              {home.today.left >= 0
                ? t('home.todayLeft', { amount: formatRM(home.today.left) })
                : t('home.todayOver', { amount: formatRM(-home.today.left) })}
            </AppText>
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 4 }}>
            <AppText variant="body" color={onHero.soft}>
              {t('home.noBudget')}
            </AppText>
            <Button title={t('home.setBudget')} variant="light" onPress={() => router.push('/budget')} />
          </View>
        )}
      <View style={{ height: 1, backgroundColor: onHero.chip, marginVertical: 12 }} />
      {balance ? (
        <View style={{ gap: 4 }}>
          <AppText variant="eyebrow" color={onHero.soft}>
            {t('home.balanceTitle')}
          </AppText>
          <AppText variant="kpi" tone={balance.left < 0 ? 'negative' : 'text'}>
            {balance.left >= 0 ? formatRM(balance.left) : `-${formatRM(-balance.left)}`}
          </AppText>
          <AppText variant="small" color={onHero.soft}>
            {balance.extra > 0
              ? t('home.balanceDetailExtra', { income: formatRM(balance.income), extra: formatRM(balance.extra), spent: formatRM(balance.spent) })
              : t('home.balanceDetail', { income: formatRM(balance.income), spent: formatRM(balance.spent) })}
          </AppText>
          {balance.upcoming > 0 ? (
            <AppText variant="small" color={onHero.soft}>
              {t('home.balanceUpcoming', { upcoming: formatRM(balance.upcoming), free: formatRM(Math.max(0, balance.afterBills)) })}
            </AppText>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <AppText variant="small" color={onHero.soft}>{t('home.balanceSetup')}</AppText>
          <Button title={t('home.balanceSetupButton')} variant="light" onPress={() => router.push('/profile')} />
        </View>
      )}
      </HeroCard>
      {(balance === null || commitments.length === 0 || expenses.length === 0) && expenses.length < GET_STARTED_MAX_SPENDINGS ? (
        <GetStarted hasSalary={balance !== null} hasBill={commitments.length > 0} hasSpending={expenses.length > 0} />
      ) : null}
      {home.tiles.length > 0 ? (
        <>
          <AppText variant="section">{t('home.categories')}</AppText>
          <TileGrid>
            {home.tiles.map((tile) => (
                <Tile
                  key={tile.categoryId}
                  title={tile.name}
                  tintName={tile.name}
                  icon={categoryById.get(tile.categoryId)?.icon}
                  status={tile.limit === null ? null : tile.status}
                  leftText={
                    tile.limit === null
                      ? t('home.spent', { amount: formatRM(tile.spent) })
                      : tile.left >= 0
                        ? t('home.left', { amount: formatRM(tile.left) })
                        : t('home.over', { amount: formatRM(-tile.left) })
                  }
                  onPress={() =>
                    router.push({ pathname: '/spending', params: { categoryId: String(tile.categoryId), at: String(Date.now()) } })
                  }
                />
            ))}
          </TileGrid>
        </>
      ) : null}
    </Screen>
  );
}
