import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { receiptPending, resolveReceiptUri, useReceiptVersion } from '@/receipts';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { radius } from './theme';
import { useTheme } from './useTheme';

/**
 * The picture for a stored receipt: its uri, or `missing` when the photo is not on this device
 * (it was added on another one and has not synced here yet), or `pending` while saved photos are still loading.
 */
export function useReceipt(stored: string | null): { uri: string; missing: boolean; pending: boolean } {
  useReceiptVersion();
  const uri = stored ? resolveReceiptUri(stored) : '';
  const pending = !!stored && uri === '' && receiptPending(stored);
  return { uri, pending, missing: !!stored && uri === '' && !pending };
}

/** Stands in for a receipt photo this device does not have, so the screen never shows an empty box. */
export function ReceiptMissing({ compact = false }: { compact?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={t('receipt.elsewhere')}
      style={{
        flex: 1, alignItems: 'center', justifyContent: 'center', gap: compact ? 2 : 8, padding: compact ? 4 : 16,
        backgroundColor: c.ground, borderRadius: radius.control,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={compact ? 20 : 32} color={c.muted} />
      {compact ? null : (
        <>
          <AppText variant="bodyStrong" style={{ textAlign: 'center' }}>{t('receipt.elsewhere')}</AppText>
          <AppText variant="small" tone="muted" style={{ textAlign: 'center' }}>{t('receipt.elsewhereHint')}</AppText>
        </>
      )}
    </View>
  );
}
