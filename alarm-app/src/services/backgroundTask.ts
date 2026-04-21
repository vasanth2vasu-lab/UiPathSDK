import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { getAlarm } from './alarmStorage';
import { sampleMotion } from './motionService';
import { markSkipped } from './alarmScheduler';
import { MOTION_WINDOW_MS } from '../types';

export const BACKGROUND_MOTION_TASK = 'smart-motion-alarm:motion-check';

TaskManager.defineTask(BACKGROUND_MOTION_TASK, async () => {
  // Best-effort: walk all alarms and for any whose pre-check window
  // intersects "now", sample motion and suppress the safety net if
  // motion is found. This runs only when the OS happens to grant a
  // background window; iOS offers no exact-time wake.
  try {
    // Scan AsyncStorage directly via the helpers.
    const mod = await import('./alarmStorage');
    const alarms = await mod.loadAlarms();
    const now = Date.now();
    for (const a of alarms) {
      if (a.status !== 'scheduled') continue;
      const start = a.fireAt - MOTION_WINDOW_MS;
      if (now < start || now > a.fireAt) continue;
      const remaining = Math.max(1000, a.fireAt - now);
      const fresh = await getAlarm(a.id);
      if (!fresh) continue;
      const result = await sampleMotion(remaining, fresh.motionThreshold);
      if (result.motionDetected) {
        await markSkipped(fresh, result.peakDelta);
      }
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundMotionTask(): Promise<void> {
  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied) {
    return;
  }
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_MOTION_TASK);
  if (isRegistered) return;
  await BackgroundFetch.registerTaskAsync(BACKGROUND_MOTION_TASK, {
    minimumInterval: 60, // seconds; OS treats as a hint
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
