import { Alert } from 'react-native';

/** Asks before something is deleted; resolves true only when the person taps Delete. */
export function confirmDelete(title: string, message: string, deleteLabel: string, cancelLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: deleteLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
