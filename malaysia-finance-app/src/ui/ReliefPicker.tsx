import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { ReliefDef } from '@/data/tax/types';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';
import { controlHeight, fontFamily, radius } from './theme';
import { useTheme } from './useTheme';

type Props = {
  reliefs: ReliefDef[];
  value: string | null;
  onChange: (reliefId: string | null) => void;
  compact?: boolean;
};

/** A field that opens a searchable list of tax reliefs; "No tax relief" clears the choice. */
export function ReliefPicker({ reliefs, value, onChange, compact = false }: Props) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = reliefs.find((r) => r.id === value);
  const text = search.trim().toLowerCase();
  const shown = text === '' ? reliefs : reliefs.filter((r) => r.name.toLowerCase().includes(text) || r.id.includes(text));

  const close = () => {
    setOpen(false);
    setSearch('');
  };
  const choose = (id: string | null) => {
    onChange(id);
    close();
  };

  const row = { paddingVertical: 14, paddingHorizontal: 4 } as const;
  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('relief.field')}
        onPress={() => setOpen(true)}
        style={{
          minHeight: compact ? 44 : controlHeight,
          borderRadius: radius.control,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.control,
          paddingHorizontal: 14,
          paddingVertical: 10,
          justifyContent: 'center',
        }}
      >
        <AppText variant="bodyStrong" tone={selected ? 'text' : 'muted'} numberOfLines={compact ? 2 : undefined}>
          {selected ? selected.name : t('relief.valueNone')}
        </AppText>
      </PressableScale>
      <Sheet visible={open} title={t('relief.pick')} onClose={close}>
        <TextInput
          accessibilityLabel={t('relief.search')}
          value={search}
          onChangeText={setSearch}
          placeholder={t('relief.search')}
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          style={{
            height: controlHeight,
            borderRadius: radius.control,
            backgroundColor: c.ground,
            paddingHorizontal: 14,
            color: c.text,
            fontFamily: fontFamily.medium,
            fontSize: 16,
          }}
        />
        <View>
            <Pressable accessibilityRole="button" onPress={() => choose(null)} style={row}>
              <AppText variant="bodyStrong" tone="muted">
                {t('relief.none')}
              </AppText>
            </Pressable>
            {shown.map((r) => (
              <Pressable key={r.id} accessibilityRole="button" onPress={() => choose(r.id)} style={row}>
                <AppText variant="body" tone={r.id === value ? 'accent' : 'text'}>
                  {r.name}
                </AppText>
              </Pressable>
            ))}
        </View>
      </Sheet>
    </>
  );
}
