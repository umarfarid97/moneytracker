import * as Device from 'expo-device';
import { Platform } from 'react-native';

/** What this device is called in the list of signed-in devices. */
export function deviceName(): string {
  if (Platform.OS === 'web') return 'Web browser';
  return Device.deviceName ?? Device.modelName ?? 'Android phone';
}
