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
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { space } from '@/ui/theme';
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
  const tileWidth = (width - space.pad * 2 - space.gap) / 2;

  return (
    <Screen fab>
      <AppText variant="small" tone="muted">
        {shortDate(today)}
      </AppText>
      <Card style={{ gap: 4 }}>
        <AppText variant="small" tone="muted">
          {t('home.today')}
        </AppText>
        <AppText variant="kpi">{formatRM(home.todaySpent)}</AppText>
        {home.today ? (
          <AppText variant="bodyStrong" tone={home.today.left >= 0 ? 'positive' : 'negative'}>
            {home.today.left >= 0
              ? t('home.todayLeft', { amount: formatRM(home.today.left) })
              : t('home.todayOver', { amount: formatRM(-home.today.left) })}
          </AppText>
        ) : (
          <View style={{ gap: 12, marginTop: 4 }}>
            <AppText variant="body" tone="muted">
              {t('home.noBudget')}
            </AppText>
            <Button title={t('home.setBudget')} onPress={() => router.push('/budget')} />
          </View>
        )}
      </Card>
      {home.hasBudget ? (
        <>
          <AppText variant="section">{t('home.categories')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.gap }}>
            {home.tiles.map((tile) => (
              <View key={tile.categoryId} style={{ width: tileWidth }}>
                <Tile
                  title={tile.name}
                  tintName={tile.name}
                  status={tile.status}
                  leftText={
                    tile.left >= 0
                      ? t('home.left', { amount: formatRM(tile.left) })
                      : t('home.over', { amount: formatRM(-tile.left) })
                  }
                  onPress={() => router.push('/budget')}
                />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
