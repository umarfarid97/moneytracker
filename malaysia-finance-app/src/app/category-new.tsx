import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { CATEGORY_PRESETS } from '@/domain/categoryPresets';
import { useCategories } from '@/hooks/useCategories';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { IconBadge } from '@/ui/IconBadge';
import { IconPicker } from '@/ui/IconPicker';
import { Screen } from '@/ui/Screen';
import { controlHeight, fontFamily, radius, type IconName } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { Ionicons } from '@expo/vector-icons';

const MAX_NAME = 24;
const NEW_ICON: IconName = 'pricetag-outline';

/** Full-screen form for a new category: pick an icon, type a name, or fill both from a suggestion. */
export default function CategoryNew() {
  const { c } = useTheme();
  const router = useRouter();
  const { data: categories, add } = useCategories();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconName>(NEW_ICON);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const taken = (n: string) => categories.some((cat) => cat.name.toLowerCase() === n.trim().toLowerCase());
  const problem = trimmed === '' ? null : trimmed.length > MAX_NAME ? t('categories.invalid') : taken(trimmed) ? t('categories.used') : null;
  const valid = trimmed !== '' && problem === null;
  const suggestions = CATEGORY_PRESETS.filter((preset) => !taken(preset.name));

  async function save() {
    setError(null);
    try {
      await add({ name: trimmed, icon });
      router.back();
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <Screen footer={<Button title={t('common.save')} disabled={!valid} onPress={save} />}>
      <BackButton />
      <AppText variant="title">{t('categories.addNew')}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('categories.icon')}
          onPress={() => setPicking(true)}
          hitSlop={6}
          style={{ width: controlHeight, height: controlHeight, borderRadius: radius.control, backgroundColor: c.surface, borderWidth: 1, borderColor: c.control, alignItems: 'center', justifyContent: 'center' }}
        >
          <IconBadge icon={icon} size={34} />
          <View style={{ position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="pencil" size={10} color={c.onAccent} />
          </View>
        </Pressable>
        <TextInput
          accessibilityLabel={t('categories.new')}
          placeholder={t('categories.new')}
          placeholderTextColor={c.muted}
          value={name}
          onChangeText={setName}
          style={{ flex: 1, height: controlHeight, borderRadius: radius.control, backgroundColor: c.surface, borderWidth: 1, borderColor: c.control, paddingHorizontal: 14, color: c.text, fontFamily: fontFamily.medium, fontSize: 16 }}
        />
      </View>
      {problem ? (
        <AppText variant="small" tone="negative">
          {problem}
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}
      {suggestions.length > 0 ? (
        <View style={{ gap: 8 }}>
          <AppText variant="smallStrong">{t('categories.suggestions')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map((preset) => (
              <Chip
                key={preset.name}
                compact
                label={preset.name}
                icon={preset.icon as IconName}
                accessibilityLabel={t('categories.usePreset', { name: preset.name })}
                onPress={() => {
                  setName(preset.name);
                  setIcon(preset.icon as IconName);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
      <IconPicker
        visible={picking}
        selected={icon}
        onClose={() => setPicking(false)}
        onPick={(next) => {
          setPicking(false);
          setIcon(next);
        }}
      />
    </Screen>
  );
}
