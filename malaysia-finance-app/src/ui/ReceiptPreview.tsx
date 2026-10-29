import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useAppLock } from '@/security/appLock';
import { AppState, Image, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n/t';

type Props = { uri: string | null; onClose: () => void };

/** The receipt photo full screen on black, fitted to the screen; tap Close or the back button to leave. */
export function ReceiptPreview({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { locked } = useAppLock();
  const [foreground, setForeground] = useState((AppState.currentState ?? 'active') === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      setForeground(next === 'active');
      if (next !== 'active') onClose();
    });
    return () => sub.remove();
  }, [onClose]);
  useEffect(() => { if (uri && (locked || !foreground)) onClose(); }, [uri, locked, foreground, onClose]);
  const visible = uri !== null && !locked && foreground;
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {visible && uri ? (
          <Image
            source={{ uri }}
            accessibilityLabel={t('receipt.preview')}
            resizeMode="contain"
            style={{ flex: 1, marginTop: insets.top + 56, marginBottom: insets.bottom + 16 }}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          hitSlop={12}
          style={{
            position: 'absolute',
            top: insets.top + 8,
            right: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.18)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={24} color="#ffffff" />
        </Pressable>
      </View>
    </Modal>
  );
}
