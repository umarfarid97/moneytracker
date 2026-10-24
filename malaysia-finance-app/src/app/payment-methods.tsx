import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { FALLBACK_PAYMENT_METHOD } from '@/db/repos/paymentMethods';
import type { PaymentKind, PaymentMethod } from '@/domain/types';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const MAX_NAME = 24;
const KINDS: PaymentKind[] = ['cash', 'debit', 'credit', 'ewallet', 'transfer'];

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
  const { data: methods, add, rename, remove } = usePaymentMethods();
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<PaymentKind>('debit');
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
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{m.name}</AppText>
          {kindLabel !== m.name ? (
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
      <AppText variant="title">{t('methods.title')}</AppText>
      <View style={{ gap: 8 }}>
        <AppText variant="smallStrong">{t('methods.new')}</AppText>
        <TextInput
          accessibilityLabel={t('methods.new')}
          value={newName}
          onChangeText={setNewName}
          placeholderTextColor={c.muted}
          style={field}
        />
        {problem(newName) ? (
          <AppText variant="small" tone="negative">
            {problem(newName)}
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {KINDS.map((k) => (
            <Chip
              key={k}
              label={t(`methods.kind.${k}`)}
              accessibilityLabel={t('methods.kindLabel', { kind: t(`methods.kind.${k}`) })}
              selected={newKind === k}
              onPress={() => setNewKind(k)}
            />
          ))}
        </View>
        <Button
          title={t('methods.add')}
          disabled={!valid(newName)}
          onPress={() => run(async () => { await add({ name: newName.trim(), kind: newKind }); setNewName(''); })}
        />
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
