import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { openReceipt, receiptPending, receiptSize, resolveReceiptUri, useReceiptVersion } from '@/receipts';
import { extensionOf, formatBytes, isImageReceipt, receiptDisplayName } from '@/receiptKind';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { radius } from './theme';
import { useTheme } from './useTheme';

/**
 * The picture for a stored receipt: its uri, or `missing` when the photo is not on this device
 * (it was added on another one and has not synced here yet), or `pending` while saved photos are still loading.
 */
export function useReceipt(stored: string | null): { uri: string; missing: boolean; pending: boolean; isImage: boolean } {
  useReceiptVersion();
  const uri = stored ? resolveReceiptUri(stored) : '';
  const pending = !!stored && uri === '' && receiptPending(stored);
  return { uri, pending, missing: !!stored && uri === '' && !pending, isImage: !stored || isImageReceipt(stored) };
}

/** A receipt that is a document rather than a picture: its type icon, name and size; tap to open or save it. */
export function ReceiptFile({ stored, compact = false }: { stored: string; compact?: boolean }) {
  const { c } = useTheme();
  useReceiptVersion();
  const size = receiptSize(stored);
  const ext = extensionOf(stored).toUpperCase();
  const name = receiptDisplayName(stored);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('receipt.open')} ${name}`}
      onPress={() => void openReceipt(stored, t('receipt.openTitle')).catch(() => {})}
      style={{
        flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: compact ? 8 : 12,
        borderRadius: radius.control, backgroundColor: c.ground,
      }}
    >
      <View style={{ width: compact ? 40 : 52, height: compact ? 40 : 52, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}>
        <Ionicons name={ext === 'PDF' ? 'document-text-outline' : 'document-outline'} size={compact ? 22 : 28} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
        <AppText variant="small" tone="muted">{size !== null ? `${ext} · ${formatBytes(size)}` : ext}</AppText>
      </View>
      <AppText variant="small" tone="accent">{t('receipt.open')}</AppText>
    </Pressable>
  );
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
