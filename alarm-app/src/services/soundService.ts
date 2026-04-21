import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Presents a local notification with the system alarm sound. We intentionally
 * avoid bundling a custom .mp3 asset — the safety-net notification scheduled
 * at T=0 already plays the system sound, and RingingScreen adds looped
 * vibration. This is used for the case where the app is in the foreground
 * and we want an extra audible cue.
 */
export async function playAlarm(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Alarm!',
        body: 'No motion detected — time to wake up.',
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'alarm' } : {}),
      },
      trigger: null, // fire immediately
    });
  } catch (e) {
    console.warn('Failed to present alarm notification', e);
  }
}

export async function stopAlarm(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // ignore
  }
}
