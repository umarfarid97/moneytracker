import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { FALLBACK_PAYMENT_METHOD } from '@/db/repos/paymentMethods';
import type { PaymentMethod } from '@/domain/types';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { methodLabel } from '@/i18n/content';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { MethodBadge } from '@/ui/MethodBadge';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const MAX_NAME = 24;

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

export default function PaymentMethods() {
  const { c } = useTheme();
  const router = useRouter();
  const { data: methods, rename, remove } = usePaymentMethods();
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const taken = (name: string, exceptId?: number) =>
    methods.some((m) => m.id !== exceptId && m.name.toLowerCase() === name.trim().toLowerCase());
  const problem = (name: string, exceptId?: number): string | null => {
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
  const card = { backgroundColor: c.surface, borderRadius: radius.control, padding: 16, gap: 8 } as const;

  const renderRow = (m: PaymentMethod) => {
    const locked = m.name === FALLBACK_PAYMENT_METHOD;
    if (editing?.id === m.id) {
      return (
        <View key={m.id} style={card}>
          <TextInput
            accessibilityLabel={t('methods.name')}
            value={editing.text}
            onChangeText={(text) => setEditing({ id: m.id, text })}
            autoFocus
            style={field}
          />
          {problem(editing.text, m.id) ? (
            <AppText variant="small" tone="negative">
              {problem(editing.text, m.id)}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title={t('common.save')}
                disabled={!valid(editing.text, m.id)}
                onPress={() => run(async () => { await rename(m.id, editing.text.trim()); setEditing(null); })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('common.cancel')} variant="secondary" onPress={() => setEditing(null)} />
            </View>
          </View>
        </View>
      );
    }
    if (deleting === m.id) {
      return (
        <View key={m.id} style={card}>
          <AppText variant="body">{t('methods.confirm', { name: m.name })}</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title={t('common.delete')}
                accessibilityLabel={t('methods.confirmLabel', { name: m.name })}
                onPress={() => run(async () => { await remove(m.id); setDeleting(null); })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('common.cancel')} variant="secondary" onPress={() => setDeleting(null)} />
            </View>
          </View>
        </View>
      );
    }
    const kindLabel = t(`methods.kind.${m.kind}`);
    return (
      <View
        key={m.id}
        style={{ backgroundColor: c.surface, borderRadius: radius.control, paddingHorizontal: 16, minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <MethodBadge name={m.name} kind={m.kind} size={36} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{methodLabel(m.name)}</AppText>
          {kindLabel !== methodLabel(m.name) ? (
            <AppText variant="small" tone="muted">
              {kindLabel}
            </AppText>
          ) : null}
        </View>
        {locked ? null : (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TextAction label={t('categories.rename')} accessibilityLabel={`${t('categories.rename')} ${m.name}`} onPress={() => { setDeleting(null); setEditing({ id: m.id, text: m.name }); }} />
            <TextAction label={t('common.delete')} accessibilityLabel={`${t('common.delete')} ${m.name}`} onPress={() => { setEditing(null); setDeleting(m.id); }} />
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen>
      <BackButton />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <AppText variant="title" style={{ flexShrink: 1 }}>{t('methods.title')}</AppText>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('methods.addNew')}
          hitSlop={8}
          onPress={() => router.push('/payment-method-new')}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={22} color={c.accentInk} />
        </PressableScale>
      </View>
      {error ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}
      <View style={{ gap: 8 }}>{methods.map(renderRow)}</View>
    </Screen>
  );
}
