export type AlarmStatus = 'scheduled' | 'ringing' | 'skipped' | 'done' | 'cancelled';

export interface Alarm {
  id: string;
  // Hour 0-23, minute 0-59. Next occurrence is computed on schedule.
  hour: number;
  minute: number;
  // Unix ms when the alarm is scheduled to fire.
  fireAt: number;
  // Peak acceleration delta (m/s^2) above which the alarm is considered "skipped".
  motionThreshold: number;
  // Id of the scheduled pre-check (wake) notification (T - WINDOW).
  preCheckNotificationId?: string;
  // Id of the scheduled safety-net alarm notification (T).
  safetyNetNotificationId?: string;
  status: AlarmStatus;
  // Set when resolved.
  resolvedAt?: number;
  resolutionReason?: string;
}

export const DEFAULT_MOTION_THRESHOLD = 1.2;
export const MOTION_WINDOW_MS = 10_000;
