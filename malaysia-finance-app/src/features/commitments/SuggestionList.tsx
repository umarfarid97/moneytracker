import { useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, TextInput, View } from 'react-native';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Chip';
import { fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export type Suggestion = {
  key: string;
  label: string;
  accessibilityLabel: string;
  leading: ReactNode;
  selected: boolean;
  onPress: () => void;
};

/** Every suggestion at once as wrapped chips in a short scrolling box, with a search field for the long lists. */
export function SuggestionList({ title, hint, items }: { title: string; hint?: string; items: Suggestion[] }) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q === '' ? items : items.filter((i) => i.label.toLowerCase().includes(q));
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="smallStrong">{title}</AppText>
      {items.length > 8 ? (
        <View style={{ height: 40, borderRadius: radius.control, borderWidth: 1, borderColor: c.control, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 }}>
          <Ionicons name="search-outline" size={18} color={c.muted} />
          <TextInput
            accessibilityLabel={t('suggest.search')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('suggest.search')}
            placeholderTextColor={c.muted}
            style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: fontFamily.medium, fontSize: 15 }}
          />
        </View>
      ) : null}
      <View style={{ maxHeight: 188, borderRadius: radius.control, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
        <ScrollView nestedScrollEnabled contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 }}>
          {shown.length === 0 ? <AppText variant="small" tone="muted">{t('suggest.none')}</AppText> : null}
          {shown.map((i) => (
            <Chip key={i.key} compact label={i.label} accessibilityLabel={i.accessibilityLabel} leading={i.leading} selected={i.selected} onPress={i.onPress} />
          ))}
        </ScrollView>
      </View>
      {hint ? <AppText variant="small" tone="muted">{hint}</AppText> : null}
    </View>
  );
}
