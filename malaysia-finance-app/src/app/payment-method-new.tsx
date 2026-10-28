import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { BRANDS } from '@/domain/banks';
import type { PaymentKind } from '@/domain/types';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { MethodBadge } from '@/ui/MethodBadge';
import { Screen } from '@/ui/Screen';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const MAX_NAME = 24;
const KINDS: PaymentKind[] = ['cash', 'debit', 'credit', 'ewallet', 'transfer'];
const CARDS: { name: string; kind: PaymentKind }[] = [
  { name: 'Visa', kind: 'credit' },
  { name: 'Mastercard', kind: 'credit' },
  { name: 'American Express', kind: 'credit' },
];
const PRESETS: { name: string; kind: PaymentKind }[] = [...BRANDS, ...CARDS];

/** Full-screen form for a new payment method: name and kind, or fill both from a suggestion. */
export default function PaymentMethodNew() {
  const { c } = useTheme();
  const router = useRouter();
  const { data: methods, add } = usePaymentMethods();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PaymentKind>('debit');
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const taken = (n: string) => methods.some((m) => m.name.toLowerCase() === n.trim().toLowerCase());
  const problem = trimmed === '' ? null : trimmed.length > MAX_NAME ? t('categories.invalid') : taken(trimmed) ? t('categories.used') : null;
  const valid = trimmed !== '' && problem === null;
  const suggestions = PRESETS.filter((p) => !taken(p.name));

  async function save() {
    setError(null);
    try {
      await add({ name: trimmed, kind });
      router.back();
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <Screen footer={<Button title={t('common.save')} disabled={!valid} onPress={save} />}>
      <BackButton />
      <AppText variant="title">{t('methods.addNew')}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: controlHeight, height: controlHeight, borderRadius: radius.control, backgroundColor: c.surface, borderWidth: 1, borderColor: c.control, alignItems: 'center', justifyContent: 'center' }}>
          <MethodBadge name={trimmed} kind={kind} size={34} />
        </View>
        <TextInput
          accessibilityLabel={t('methods.new')}
          placeholder={t('methods.new')}
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {KINDS.map((k) => (
          <Chip
            key={k}
            compact
            label={t(`methods.kind.${k}`)}
            accessibilityLabel={t('methods.kindLabel', { kind: t(`methods.kind.${k}`) })}
            selected={kind === k}
            onPress={() => setKind(k)}
          />
        ))}
      </View>
      {suggestions.length > 0 ? (
        <View style={{ gap: 8 }}>
          <AppText variant="smallStrong">{t('categories.suggestions')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map((p) => (
              <Chip
                key={p.name}
                compact
                label={p.name}
                accessibilityLabel={t('methods.preset', { name: p.name })}
                leading={<MethodBadge name={p.name} kind={p.kind} size={22} />}
                onPress={() => {
                  setName(p.name);
                  setKind(p.kind);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
