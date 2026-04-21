import type { Alarm } from '../types';
import { MOTION_WINDOW_MS } from '../types';
import { upsertAlarm, removeAlarm } from './alarmStorage';
import {
  cancelNotification,
  schedulePreCheckNotification,
  scheduleSafetyNetNotification,
} from './notifications';

function randomId(): string {
  return `alarm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Compute the next Date matching hh:mm. Tomorrow if already past today. */
export function nextOccurrence(hour: number, minute: number, from = new Date()): Date {
  const next = new Date(from);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= from.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export async function scheduleAlarm(
  hour: number,
  minute: number,
  motionThreshold: number,
): Promise<Alarm> {
  const fireAt = nextOccurrence(hour, minute).getTime();
  const preCheckAt = fireAt - MOTION_WINDOW_MS;
  const id = randomId();

  const preCheckNotificationId = await schedulePreCheckNotification(id, fireAt, preCheckAt);
  const safetyNetNotificationId = await scheduleSafetyNetNotification(id, fireAt);

  const alarm: Alarm = {
    id,
    hour,
    minute,
    fireAt,
    motionThreshold,
    preCheckNotificationId,
    safetyNetNotificationId,
    status: 'scheduled',
  };
  await upsertAlarm(alarm);
  return alarm;
}

export async function cancelAlarm(alarm: Alarm): Promise<void> {
  await cancelNotification(alarm.preCheckNotificationId);
  await cancelNotification(alarm.safetyNetNotificationId);
  await removeAlarm(alarm.id);
}

/** Mark an alarm as skipped (motion detected) and suppress the safety-net ring. */
export async function markSkipped(alarm: Alarm, peakDelta: number): Promise<Alarm> {
  await cancelNotification(alarm.safetyNetNotificationId);
  const updated: Alarm = {
    ...alarm,
    status: 'skipped',
    resolvedAt: Date.now(),
    resolutionReason: `Motion detected (peak ${peakDelta.toFixed(2)} m/s²)`,
  };
  await upsertAlarm(updated);
  return updated;
}

export async function markRinging(alarm: Alarm, peakDelta: number): Promise<Alarm> {
  const updated: Alarm = {
    ...alarm,
    status: 'ringing',
    resolvedAt: Date.now(),
    resolutionReason: `No motion (peak ${peakDelta.toFixed(2)} m/s²)`,
  };
  await upsertAlarm(updated);
  return updated;
}

export async function markDone(alarm: Alarm): Promise<Alarm> {
  const updated: Alarm = { ...alarm, status: 'done' };
  await upsertAlarm(updated);
  return updated;
}
