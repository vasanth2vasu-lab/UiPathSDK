# Smart Motion Alarm

Cross-platform mobile alarm app (iOS + Android) built with **Expo / React Native / TypeScript**.

**Rule:** When the alarm time arrives, the app samples the phone's motion sensor for 10 seconds. If motion is detected (you're already moving), the alarm is **skipped**. If no motion is detected (you're still asleep), the alarm **rings**.

## Quick start

```bash
cd alarm-app
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone (iOS App Store / Android Play Store). Grant motion and notification permissions when prompted.

## How it works

For every alarm you set, two local notifications are scheduled:

1. **Pre-check notification** at `alarmTime − 10s` — silent, wakes the app.
2. **Safety-net notification** at `alarmTime` — system alarm sound; this is the "actual ring" that always fires unless suppressed.

When the pre-check fires, the app samples `DeviceMotion` for 10 seconds and tracks peak gravity-subtracted acceleration magnitude (m/s²).

- **Peak ≥ threshold** → motion detected → cancel the safety-net notification → mark alarm as "skipped". Phone stays quiet.
- **Peak < threshold** → no motion → let the safety-net notification ring; if the app is foregrounded, also present an immediate notification + vibrate.

Default motion threshold is **1.2 m/s²**, adjustable per alarm.

## Background behaviour (important)

Mobile OSes restrict background sensor access. Be aware of what works where:

- **Android**: Best-effort background motion check runs via `expo-background-fetch` and the scheduled pre-check notification. If the OS suspends the task, the safety-net notification still rings. Keeping the app foregrounded overnight gives the most reliable skip behaviour.
- **iOS**: Apps cannot reliably run sensor code at an exact time in the background. The safety-net notification will always play the system alarm sound. The motion-skip feature only runs when the app is foregrounded (or when iOS happens to grant a background window, which is not guaranteed). For best results, open the app at bedtime — `expo-keep-awake` is used on the ringing screen, but consider keeping your screen on while the app is open.

## Permissions

- iOS: `NSMotionUsageDescription`, notifications.
- Android: `ACTIVITY_RECOGNITION`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `WAKE_LOCK`, `SCHEDULE_EXACT_ALARM`, `VIBRATE`.

## Project layout

```
alarm-app/
  App.tsx                     # root; screen routing, app lifecycle wiring
  index.ts                    # Expo entry
  app.json                    # Expo config and permissions
  src/
    types.ts
    screens/
      HomeScreen.tsx          # alarm list
      SetAlarmScreen.tsx      # time picker + threshold
      RingingScreen.tsx       # full-screen STOP
    components/
      AlarmCard.tsx
      MotionMeter.tsx         # live accel magnitude (debug)
    services/
      alarmStorage.ts         # AsyncStorage persistence
      motionService.ts        # DeviceMotion wrapper + sampleMotion
      alarmScheduler.ts       # schedule / cancel / mark state
      soundService.ts         # foreground alert (system sound + vibrate)
      notifications.ts        # expo-notifications config + scheduling
      backgroundTask.ts       # expo-task-manager best-effort background check
```

## Manual test matrix

| Case | Setup | Expected |
| --- | --- | --- |
| Skip (motion) | Set alarm ~1 min out. Shake phone at T−10s..T | "Skipped" status; no ring |
| Ring (still) | Set alarm ~1 min out. Don't touch phone | System sound + vibration at T |
| Cancel | Set alarm, tap Cancel before T | Alarm removed; nothing fires |
| Android bg | Set alarm, lock phone | Best-effort skip or safety-net ring |
| iOS bg | Set alarm, lock phone | Safety-net ring always; skip only if foregrounded |

## Known limitations / non-goals

- No recurring / weekday alarms (one-shot next occurrence only).
- No multiple-alarms-firing-at-once handling.
- No custom sound upload; uses system default notification sound.
- iOS background motion detection is not guaranteed (see above).
