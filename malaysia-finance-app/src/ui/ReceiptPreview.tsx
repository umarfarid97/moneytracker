import { Ionicons } from '@expo/vector-icons';
import { Image, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n/t';

type Props = { uri: string | null; onClose: () => void };

/** The receipt photo full screen on black, fitted to the screen; tap Close or the back button to leave. */
export function ReceiptPreview({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={uri !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {uri ? (
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
