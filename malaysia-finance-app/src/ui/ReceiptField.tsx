import { useState } from 'react';
import { Image, View } from 'react-native';
import { pickReceipt, type ReceiptSource } from '@/receipts';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { Button } from './Button';
import { radius } from './theme';

type Props = {
  /** Stored picture uri, or null when none. */
  uri: string | null;
  onChange: (uri: string | null) => void;
};

/** Attach a receipt: take a photo or choose one; shows the picture once attached. */
export function ReceiptField({ uri, onChange }: Props) {
  const [busy, setBusy] = useState(false);

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
    <View style={{ gap: 8 }}>
      <AppText variant="smallStrong">{t('expense.receipt')}</AppText>
      {uri ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image
            source={{ uri }}
            accessibilityLabel={t('expense.receipt')}
            style={{ width: 64, height: 64, borderRadius: radius.sm }}
          />
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            {t('receipt.attached')}
          </AppText>
          <Button title={t('receipt.remove')} variant="secondary" onPress={() => onChange(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title={t('receipt.take')} variant="secondary" disabled={busy} onPress={() => pick('camera')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('receipt.choose')} variant="secondary" disabled={busy} onPress={() => pick('library')} />
          </View>
        </View>
      )}
    </View>
  );
}
