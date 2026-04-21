import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';

export interface MotionSampleResult {
  motionDetected: boolean;
  peakDelta: number;
  samples: number;
}

const GRAVITY = 9.81;

function magnitudeDelta(m: DeviceMotionMeasurement): number {
  // accelerationIncludingGravity is the raw reading. Subtract gravity baseline
  // so a still phone sitting flat reports ~0, not ~9.81.
  const a = m.accelerationIncludingGravity;
  if (!a) return 0;
  const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  return Math.abs(mag - GRAVITY);
}

/**
 * Subscribe to the DeviceMotion API for `windowMs`, return whether peak
 * acceleration delta exceeded `threshold` (m/s^2).
 */
export async function sampleMotion(
  windowMs: number,
  threshold: number,
  onTick?: (peak: number) => void,
): Promise<MotionSampleResult> {
  const available = await DeviceMotion.isAvailableAsync();
  if (!available) {
    return { motionDetected: false, peakDelta: 0, samples: 0 };
  }

  DeviceMotion.setUpdateInterval(100);

  let peakDelta = 0;
  let samples = 0;

  const sub = DeviceMotion.addListener((measurement) => {
    const delta = magnitudeDelta(measurement);
    samples += 1;
    if (delta > peakDelta) {
      peakDelta = delta;
      onTick?.(peakDelta);
    }
  });

  await new Promise<void>((resolve) => setTimeout(resolve, windowMs));
  sub.remove();

  return {
    motionDetected: peakDelta >= threshold,
    peakDelta,
    samples,
  };
}

/**
 * Start a live motion subscription (for the debug meter). Returns an
 * unsubscribe function. `onReading` is called with the current delta
 * magnitude at ~10Hz.
 */
export function subscribeLiveMotion(onReading: (delta: number) => void): () => void {
  DeviceMotion.setUpdateInterval(100);
  const sub = DeviceMotion.addListener((m) => onReading(magnitudeDelta(m)));
  return () => sub.remove();
}
