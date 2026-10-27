import { DemoBanner } from '@/features/demo/DemoBanner';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { periodKey } from '@/domain/budgetPeriod';
import { balanceLeft } from '@/domain/balance';
import { buildHome } from '@/domain/summary';
import { shortDate } from '@/domain/dates';
import { resolveCategories, resolveWidgets } from '@/domain/homeLayout';
import { formatRM } from '@/domain/money';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useCommitments } from '@/hooks/useCommitments';
import { useExpenses } from '@/hooks/useExpenses';
import { useData } from '@/hooks/DataProvider';
import { useEstimatedPcb } from '@/hooks/useEstimatedPcb';
import { OPTIONAL_WIDGETS } from '@/features/home/widgets';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { GET_STARTED_MAX_SPENDINGS, GetStarted } from '@/features/onboarding/GetStarted';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { Screen } from '@/ui/Screen';
import { radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { loadHideBalance, saveHideBalance } from '@/ui/appearanceStorage';
import { Tile } from '@/ui/Tile';
import { TileGrid } from '@/ui/TileGrid';

export default function Home() {
  const today = useToday();
  const { data: expenses } = useExpenses();
  const { data: categories } = useCategories();
  const { data: profile } = useProfile();
  const { data: commitments } = useCommitments();
  const { incomeEntries, homeLayout } = useData();
  const startDay = profile.budgetStartDay;
  const { data: budgets } = useBudgets(periodKey(today, startDay));
  const home = useMemo(
    () => buildHome({ categories, expenses, budgets, today, startDay }),
    [categories, expenses, budgets, today, startDay],
  );
  const estimatedPcb = useEstimatedPcb();
  const balance = useMemo(
    () => balanceLeft({ profile, expenses, commitments, today, extraIncome: incomeEntries, estimatedPcb }),
    [profile, expenses, commitments, today, incomeEntries, estimatedPcb],
  );
  const [hidden, setHidden] = useState(loadHideBalance);
  const toggleHidden = () => {
    saveHideBalance(!hidden);
    setHidden(!hidden);
  };
  const money = (cents: number) => (hidden ? 'RM ••••' : formatRM(cents));
  const categoryById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);

  const { c } = useTheme();
  const visibleTiles = useMemo(() => {
    const tileById = new Map(home.tiles.map((tile) => [tile.categoryId, tile]));
    return resolveCategories(homeLayout, categories)
      .filter((entry) => entry.visible)
      .map((entry) => tileById.get(entry.category.id))
      .filter((tile) => tile !== undefined);
  }, [homeLayout, categories, home.tiles]);

  const todaySection = (
    <View style={{ gap: 6 }}>
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
    </View>
  );
  const balanceSection = (
    <>
      {balance ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="eyebrow" color={onHero.soft}>
              {t('home.balanceTitle')}
            </AppText>
            <Pressable
              onPress={toggleHidden}
              accessibilityRole="button"
              accessibilityLabel={t(hidden ? 'home.balanceShow' : 'home.balanceHide')}
              hitSlop={12}
            >
              <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={onHero.soft} />
            </Pressable>
          </View>
          <AppText variant="kpi" tone={balance.left < 0 && !hidden ? 'negative' : 'text'}>
            {hidden ? money(0) : balance.left >= 0 ? formatRM(balance.left) : `-${formatRM(-balance.left)}`}
          </AppText>
          <AppText variant="small" color={onHero.soft}>
            {balance.extra > 0
              ? t('home.balanceDetailExtra', { income: money(balance.income), extra: money(balance.extra), spent: money(balance.spent) })
              : t('home.balanceDetail', { income: money(balance.income), spent: money(balance.spent) })}
          </AppText>
          {balance.upcoming > 0 ? (
            <AppText variant="small" color={onHero.soft}>
              {t('home.balanceUpcoming', { upcoming: money(balance.upcoming), free: money(Math.max(0, balance.afterBills)) })}
            </AppText>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <AppText variant="small" color={onHero.soft}>{t('home.balanceSetup')}</AppText>
          <Button title={t('home.balanceSetupButton')} variant="light" onPress={() => router.push('/profile')} />
        </View>
      )}
    </>
  );
  const getStarted = (
    <>
      {(balance === null || commitments.length === 0 || expenses.length === 0) && expenses.length < GET_STARTED_MAX_SPENDINGS ? (
        <GetStarted hasSalary={balance !== null} hasBill={commitments.length > 0} hasSpending={expenses.length > 0} />
      ) : null}
    </>
  );
  const categorySection = (
    <>
      {visibleTiles.length > 0 ? (
        <>
          <AppText variant="section">{t('home.categories')}</AppText>
          <TileGrid>
            {visibleTiles.map((tile) => (
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
    </>
  );

  const cards = resolveWidgets(homeLayout).filter((w) => w.visible);
  const nodes: ReactNode[] = [];
  cards.forEach((w, i) => {
    if (w.id === 'balance' && cards[i - 1]?.id === 'today') return; // drawn inside the Today card
    if (w.id === 'today') {
      const joined = cards[i + 1]?.id === 'balance';
      nodes.push(
        <HeroCard key="today" style={{ gap: 6 }}>
          {todaySection}
          {joined ? (
            <>
              <View style={{ height: 1, backgroundColor: onHero.chip, marginVertical: 12 }} />
              {balanceSection}
            </>
          ) : null}
        </HeroCard>,
      );
    } else if (w.id === 'balance') {
      nodes.push(<HeroCard key="balance" style={{ gap: 6 }}>{balanceSection}</HeroCard>);
    } else if (w.id === 'getStarted') {
      nodes.push(<Fragment key="getStarted">{getStarted}</Fragment>);
    } else if (w.id === 'categories') {
      nodes.push(<Fragment key="categories">{categorySection}</Fragment>);
    } else {
      const widget = OPTIONAL_WIDGETS[w.id];
      if (widget) nodes.push(<Fragment key={w.id}>{widget()}</Fragment>);
    }
  });

  return (
    <Screen fab>
      <DemoBanner />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title">{shortDate(today)}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.customize')}
          hitSlop={12}
          onPress={() => router.push('/customize-home')}
        >
          <Ionicons name="options-outline" size={26} color={c.text} />
        </Pressable>
      </View>
      {nodes}
    </Screen>
  );
}
