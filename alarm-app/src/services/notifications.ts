import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermissions(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
}

export async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('alarm', {
    name: 'Alarm',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 500, 500, 500],
  });
  await Notifications.setNotificationChannelAsync('pre-check', {
    name: 'Pre-check',
    importance: Notifications.AndroidImportance.HIGH,
    sound: null,
  });
}

/** Schedule the T-window "wake up to check motion" notification. */
export async function schedulePreCheckNotification(
  alarmId: string,
  fireAt: number,
  preCheckAt: number,
): Promise<string> {
  const delaySeconds = Math.max(1, Math.floor((preCheckAt - Date.now()) / 1000));
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Checking for motion…',
      body: 'Deciding whether to ring.',
      data: { alarmId, kind: 'pre-check', fireAt },
      sound: null,
      ...(Platform.OS === 'android' ? { channelId: 'pre-check' } : {}),
    },
    trigger: { seconds: delaySeconds },
  });
}

/** Schedule the T0 safety-net loud alarm notification. */
export async function scheduleSafetyNetNotification(
  alarmId: string,
  fireAt: number,
): Promise<string> {
  const delaySeconds = Math.max(1, Math.floor((fireAt - Date.now()) / 1000));
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Alarm!',
      body: 'No motion detected — time to wake up.',
      data: { alarmId, kind: 'safety-net' },
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: 'alarm' } : {}),
    },
    trigger: { seconds: delaySeconds },
  });
}

export async function cancelNotification(id?: string): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignore if already delivered
  }
}
