import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { pickReceipt, resolveReceiptUri, type ReceiptSource } from '@/receipts';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { Button } from './Button';
import { ReceiptPreview } from './ReceiptPreview';
import { radius } from './theme';

type Props = {
  /** Stored picture uri, or null when none. */
  uri: string | null;
  onChange: (uri: string | null) => void;
  compact?: boolean;
};

/** Attach a receipt: take a photo or choose one; shows the picture once attached. */
export function ReceiptField({ uri, onChange, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  async function pick(source: ReceiptSource) {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await pickReceipt(source);
      if (picked) onChange(picked);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: compact ? 4 : 8 }}>
      <AppText variant="eyebrow" tone="muted">{t('expense.receipt')}</AppText>
      {uri ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Tap the photo, or its label, to see it full screen. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('receipt.view')}
            onPress={() => setPreviewing(true)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <Image
              source={{ uri: resolveReceiptUri(uri) }}
              accessibilityLabel={t('expense.receipt')}
              style={{ width: compact ? 44 : 64, height: compact ? 44 : 64, borderRadius: radius.sm }}
            />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{t('receipt.attached')}</AppText>
              <AppText variant="small" tone="accent">
                {t('receipt.view')}
              </AppText>
            </View>
          </Pressable>
          <Button title={t('receipt.remove')} variant="secondary" compact={compact} onPress={() => onChange(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title={t('receipt.take')} variant="secondary" compact={compact} disabled={busy} onPress={() => pick('camera')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('receipt.choose')} variant="secondary" compact={compact} disabled={busy} onPress={() => pick('library')} />
          </View>
        </View>
      )}
      <ReceiptPreview uri={previewing && uri ? resolveReceiptUri(uri) : null} onClose={() => setPreviewing(false)} />
    </View>
  );
}
