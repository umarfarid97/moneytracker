import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { FALLBACK_CATEGORY } from '@/db/repos/categories';
import type { Category } from '@/domain/types';
import { useCategories } from '@/hooks/useCategories';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { PressableScale } from '@/ui/PressableScale';
import { IconBadge } from '@/ui/IconBadge';
import { IconPicker } from '@/ui/IconPicker';
import { Screen } from '@/ui/Screen';
import { categoryLook, controlHeight, fontFamily, radius, type IconName } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const MAX_NAME = 24;
const NEW_ICON: IconName = 'pricetag-outline';

function TextAction({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} hitSlop={8} style={{ paddingVertical: 6 }}>
      <AppText variant="bodyStrong" color={c.accent}>
        {label}
      </AppText>
    </PressableScale>
  );
}

export default function Categories() {
  const { c } = useTheme();
  const { data: categories, add, rename, setIcon, remove } = useCategories();
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState<IconName>(NEW_ICON);
  /** Which icon the picker is choosing: the new category's, or an existing category's id. */
  const [picking, setPicking] = useState<'new' | number | null>(null);
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const taken = (name: string, exceptId?: number) =>
    categories.some((cat) => cat.id !== exceptId && cat.name.toLowerCase() === name.trim().toLowerCase());
  const nameProblem = (name: string, exceptId?: number): string | null => {
    const trimmed = name.trim();
    if (trimmed === '') return null;
    if (trimmed.length > MAX_NAME) return t('categories.invalid');
    return taken(trimmed, exceptId) ? t('categories.used') : null;
  };
  const valid = (name: string, exceptId?: number) =>
    name.trim() !== '' && name.trim().length <= MAX_NAME && !taken(name, exceptId);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  const field = {
    height: controlHeight,
    borderRadius: radius.control,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.control,
    paddingHorizontal: 14,
    color: c.text,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  } as const;

  const pickingCat = typeof picking === 'number' ? categories.find((cat) => cat.id === picking) : undefined;

  // Tapping a category's icon opens the picker; a small pencil shows it can be changed.
  const iconButton = (icon: IconName, label: string, onPress: () => void, onGround = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={[
        { width: 44, height: 44, borderRadius: radius.control, backgroundColor: c.ground, alignItems: 'center', justifyContent: 'center' },
        // Beside the new-category field it sits on the page, so it takes the field's white box instead.
        onGround && { width: controlHeight, height: controlHeight, backgroundColor: c.surface, borderWidth: 1, borderColor: c.control },
      ]}
    >
      <IconBadge icon={icon} size={34} />
      <View style={{ position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="pencil" size={10} color={c.onAccent} />
      </View>
    </Pressable>
  );

  const renderRow = (cat: Category) => {
    const locked = cat.name === FALLBACK_CATEGORY;
    if (editing?.id === cat.id) {
      return (
        <View key={cat.id} style={{ backgroundColor: c.surface, borderRadius: radius.control, padding: 16, gap: 8 }}>
          <TextInput
            accessibilityLabel={t('categories.name')}
            value={editing.text}
            onChangeText={(text) => setEditing({ id: cat.id, text })}
            autoFocus
            style={field}
          />
          {nameProblem(editing.text, cat.id) ? (
            <AppText variant="small" tone="negative">
              {nameProblem(editing.text, cat.id)}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title={t('common.save')}
                disabled={!valid(editing.text, cat.id)}
                onPress={() => run(async () => { await rename(cat.id, editing.text.trim()); setEditing(null); })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('common.cancel')} variant="secondary" onPress={() => setEditing(null)} />
            </View>
          </View>
        </View>
      );
    }
    if (deleting === cat.id) {
      return (
        <View key={cat.id} style={{ backgroundColor: c.surface, borderRadius: radius.control, padding: 16, gap: 8 }}>
          <AppText variant="body">{t('categories.confirm', { name: cat.name })}</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title={t('common.delete')}
                accessibilityLabel={t('categories.confirmLabel', { name: cat.name })}
                onPress={() => run(async () => { await remove(cat.id); setDeleting(null); })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('common.cancel')} variant="secondary" onPress={() => setDeleting(null)} />
            </View>
          </View>
        </View>
      );
    }
    return (
      <View
        key={cat.id}
        style={{ backgroundColor: c.surface, borderRadius: radius.control, paddingHorizontal: 16, minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {iconButton(categoryLook(cat.name, cat.icon).icon, t('categories.iconFor', { name: cat.name }), () => setPicking(cat.id))}
          <AppText variant="bodyStrong" style={{ flexShrink: 1 }}>
            {cat.name}
          </AppText>
        </View>
        {locked ? null : (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TextAction label={t('categories.rename')} accessibilityLabel={`${t('categories.rename')} ${cat.name}`} onPress={() => { setDeleting(null); setEditing({ id: cat.id, text: cat.name }); }} />
            <TextAction label={t('common.delete')} accessibilityLabel={`${t('common.delete')} ${cat.name}`} onPress={() => { setEditing(null); setDeleting(cat.id); }} />
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('categories.title')}</AppText>
      <View style={{ gap: 8 }}>
        <AppText variant="smallStrong">{t('categories.new')}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {iconButton(newIcon, t('categories.icon'), () => setPicking('new'), true)}
          <TextInput
            accessibilityLabel={t('categories.new')}
            value={newName}
            onChangeText={setNewName}
            placeholderTextColor={c.muted}
            style={[field, { flex: 1 }]}
          />
        </View>
        {nameProblem(newName) ? (
          <AppText variant="small" tone="negative">
            {nameProblem(newName)}
          </AppText>
        ) : null}
        <Button
          title={t('categories.add')}
          disabled={!valid(newName)}
          onPress={() => run(async () => { await add({ name: newName.trim(), icon: newIcon }); setNewName(''); setNewIcon(NEW_ICON); })}
        />
      </View>
      {error ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}
      <View style={{ gap: 8 }}>{categories.map(renderRow)}</View>
      <IconPicker
        visible={picking !== null}
        selected={picking === 'new' ? newIcon : pickingCat ? categoryLook(pickingCat.name, pickingCat.icon).icon : undefined}
        onClose={() => setPicking(null)}
        onPick={(icon) => {
          const target = picking;
          setPicking(null);
          if (target === 'new') setNewIcon(icon);
          else if (target !== null) run(() => setIcon(target, icon));
        }}
      />
    </Screen>
  );
}
