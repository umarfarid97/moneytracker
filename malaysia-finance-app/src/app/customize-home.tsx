import { useMemo } from 'react';
import { View } from 'react-native';
import {
  isDefaultLayout, moveItem, resolveCategories, resolveWidgets, DEFAULT_HOME_LAYOUT,
  withCategories, withWidgets,
} from '@/domain/homeLayout';
import { useCategories } from '@/hooks/useCategories';
import { useData } from '@/hooks/DataProvider';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { confirmDelete } from '@/ui/confirm';
import { IconBadge } from '@/ui/IconBadge';
import { ReorderList } from '@/ui/ReorderList';
import { Screen } from '@/ui/Screen';
import { categoryLook } from '@/ui/theme';

export default function CustomizeHome() {
  const { homeLayout, saveHomeLayout } = useData();
  const { data: categories } = useCategories();
  const widgets = useMemo(() => resolveWidgets(homeLayout), [homeLayout]);
  const cats = useMemo(() => resolveCategories(homeLayout, categories), [homeLayout, categories]);
  const save = (update: Parameters<typeof saveHomeLayout>[0]) => {
    saveHomeLayout(update).catch(() => {});
  };
  const reset = async () => {
    if (await confirmDelete(t('customize.resetConfirm'), t('customize.resetBody'), t('customize.reset'), t('common.cancel'))) {
      save(DEFAULT_HOME_LAYOUT);
    }
  };
  const noneShown = cats.length > 0 && cats.every((c) => !c.visible);

  return (
    <Screen>
      <BackButton />
      <View style={{ gap: 4 }}>
        <AppText variant="title">{t('customize.title')}</AppText>
        <AppText variant="body" tone="muted">{t('customize.intro')}</AppText>
      </View>

      <AppText variant="section">{t('customize.cards')}</AppText>
      <ReorderList
        items={widgets.map((w) => ({
          key: w.id,
          title: t(`widget.${w.id}` as StringKey),
          subtitle: t(`widget.hint.${w.id}` as StringKey),
          visible: w.visible,
        }))}
        onMove={(from, to) => save((prev) => withWidgets(prev, moveItem(resolveWidgets(prev), from, to)))}
        onToggle={(key) =>
          save((prev) => withWidgets(prev, resolveWidgets(prev).map((w) => (w.id === key ? { ...w, visible: !w.visible } : w))))
        }
      />

      <View style={{ gap: 4 }}>
        <AppText variant="section">{t('customize.categories')}</AppText>
        <AppText variant="small" tone="muted">{t('customize.categoriesHint')}</AppText>
        {noneShown ? <AppText variant="small" tone="muted">{t('customize.allHidden')}</AppText> : null}
      </View>
      <ReorderList
        items={cats.map((e) => {
          const look = categoryLook(e.category.name, e.category.icon);
          return {
            key: String(e.category.id),
            title: e.category.name,
            visible: e.visible,
            leading: <IconBadge icon={look.icon} color={look.color} size={28} />,
          };
        })}
        onMove={(from, to) => save((prev) => withCategories(prev, moveItem(resolveCategories(prev, categories), from, to)))}
        onToggle={(key) =>
          save((prev) =>
            withCategories(prev, resolveCategories(prev, categories).map((e) => (String(e.category.id) === key ? { ...e, visible: !e.visible } : e))),
          )
        }
      />

      <Button title={t('customize.reset')} variant="secondary" onPress={reset} disabled={isDefaultLayout(homeLayout)} />
    </Screen>
  );
}
