import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { buildHome } from '@/domain/summary';
import { shortDate } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { Screen } from '@/ui/Screen';
import { radius, space } from '@/ui/theme';
import { Tile } from '@/ui/Tile';

export default function Home() {
  const today = useToday();
  const { width } = useWindowDimensions();
  const { data: expenses } = useExpenses();
  const { data: categories } = useCategories();
  const { data: budgets } = useBudgets(today.slice(0, 7));
  const home = useMemo(
    () => buildHome({ categories, expenses, budgets, today }),
    [categories, expenses, budgets, today],
  );
  const categoryById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);
  const tileWidth = (width - space.pad * 2 - space.gap) / 2;

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
            <Ionicons name={home.today.left >= 0 ? 'checkmark-circle' : 'alert-circle'} size={16} color={onHero.ink} />
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
      </HeroCard>
      {home.tiles.length > 0 ? (
        <>
          <AppText variant="section">{t('home.categories')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.gap }}>
            {home.tiles.map((tile) => (
              <View key={tile.categoryId} style={{ width: tileWidth, flexDirection: 'row' }}>
                <Tile
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
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
