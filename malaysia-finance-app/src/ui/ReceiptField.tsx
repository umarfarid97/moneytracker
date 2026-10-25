import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { pickReceipt, resolveReceiptUri, type ReceiptSource } from '@/receipts';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { Button } from './Button';
import { ReceiptPreview } from './ReceiptPreview';
import { radius } from './theme';
import { useTheme } from './useTheme';

type Props = {
  /** Stored picture uri, or null when none. */
  uri: string | null;
  onChange: (uri: string | null) => void;
  compact?: boolean;
  /** Grows to fill its parent, with a large preview or an empty drop area. For wide screens. */
  fill?: boolean;
};

/** Attach a receipt: take a photo or choose one; shows the picture once attached. */
export function ReceiptField({ uri, onChange, compact = false, fill = false }: Props) {
  const { c } = useTheme();
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

  const buttons = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Button title={t('receipt.take')} variant="secondary" compact={compact} disabled={busy} onPress={() => pick('camera')} />
      </View>
      <View style={{ flex: 1 }}>
        <Button title={t('receipt.choose')} variant="secondary" compact={compact} disabled={busy} onPress={() => pick('library')} />
      </View>
    </View>
  );
  const preview = <ReceiptPreview uri={previewing && uri ? resolveReceiptUri(uri) : null} onClose={() => setPreviewing(false)} />;

  if (fill) {
    return (
      <View style={{ flexGrow: 1, gap: compact ? 8 : 12 }}>
        <AppText variant="eyebrow" tone="muted">{t('expense.receipt')}</AppText>
        {uri ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('receipt.view')}
              onPress={() => setPreviewing(true)}
              style={{ flexGrow: 1, minHeight: compact ? 140 : 200, borderRadius: radius.control, backgroundColor: c.ground, overflow: 'hidden' }}
            >
              <Image
                source={{ uri: resolveReceiptUri(uri) }}
                accessibilityLabel={t('expense.receipt')}
                resizeMode="contain"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{t('receipt.attached')}</AppText>
                <AppText variant="small" tone="muted">
                  {t('receipt.tapToView')}
                </AppText>
              </View>
              <Button title={t('receipt.remove')} variant="secondary" compact={compact} onPress={() => onChange(null)} />
            </View>
          </>
        ) : (
          <>
            <View
              style={{
                flexGrow: 1, minHeight: compact ? 96 : 160, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed',
                borderColor: c.border, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20,
              }}
            >
              <Ionicons name="receipt-outline" size={compact ? 28 : 40} color={c.muted} />
              <AppText variant="small" tone="muted" style={{ textAlign: 'center' }}>
                {t('receipt.empty')}
              </AppText>
            </View>
            {buttons}
          </>
        )}
        {preview}
      </View>
    );
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
        buttons
      )}
      {preview}
    </View>
  );
}
