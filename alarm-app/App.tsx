import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, StatusBar } from 'react-native';
import * as Notifications from 'expo-notifications';

import type { Alarm } from './src/types';

type NotificationSub = ReturnType<typeof Notifications.addNotificationReceivedListener>;
import { MOTION_WINDOW_MS } from './src/types';
import { HomeScreen } from './src/screens/HomeScreen';
import { SetAlarmScreen } from './src/screens/SetAlarmScreen';
import { RingingScreen } from './src/screens/RingingScreen';
import { loadAlarms, getAlarm } from './src/services/alarmStorage';
import {
  scheduleAlarm,
  cancelAlarm,
  markSkipped,
  markRinging,
  markDone,
} from './src/services/alarmScheduler';
import { sampleMotion } from './src/services/motionService';
import { playAlarm, stopAlarm } from './src/services/soundService';
import {
  ensurePermissions,
  configureAndroidChannel,
} from './src/services/notifications';
import { registerBackgroundMotionTask } from './src/services/backgroundTask';

type View = 'home' | 'set' | 'ringing';

export default function App() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [view, setView] = useState<View>('home');
  const [refreshing, setRefreshing] = useState(false);
  const [ringingReason, setRingingReason] = useState('');
  const notificationSubRef = useRef<NotificationSub | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setAlarms(await loadAlarms());
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Run a motion check for a given alarm. Called when the pre-check
  // notification fires and the app is foregrounded, or from AppState
  // transitions if the OS delivered the notification while backgrounded.
  const runMotionCheck = useCallback(
    async (alarmId: string) => {
      if (inFlightRef.current.has(alarmId)) return;
      inFlightRef.current.add(alarmId);
      try {
        const alarm = await getAlarm(alarmId);
        if (!alarm || alarm.status !== 'scheduled') return;

        const remaining = Math.max(1_000, alarm.fireAt - Date.now());
        const window = Math.min(MOTION_WINDOW_MS, remaining);
        const result = await sampleMotion(window, alarm.motionThreshold);

        if (result.motionDetected) {
          const updated = await markSkipped(alarm, result.peakDelta);
          setAlarms(await loadAlarms());
          Alert.alert(
            'Alarm skipped',
            `Motion detected — peak ${result.peakDelta.toFixed(2)} m/s².`,
          );
          await markDone(updated);
        } else {
          const updated = await markRinging(alarm, result.peakDelta);
          setAlarms(await loadAlarms());
          setRingingReason(updated.resolutionReason ?? 'No motion detected.');
          setView('ringing');
          await playAlarm();
        }
      } finally {
        inFlightRef.current.delete(alarmId);
      }
    },
    [],
  );

  // Setup: permissions, channels, background task, notification listener.
  useEffect(() => {
    (async () => {
      await ensurePermissions();
      await configureAndroidChannel();
      await registerBackgroundMotionTask();
      await refresh();

      notificationSubRef.current = Notifications.addNotificationReceivedListener(
        (notif) => {
          const data = notif.request.content.data as {
            alarmId?: string;
            kind?: string;
          };
          if (data?.kind === 'pre-check' && data.alarmId) {
            runMotionCheck(data.alarmId);
          }
        },
      );
    })();

    return () => {
      notificationSubRef.current?.remove();
    };
  }, [runMotionCheck, refresh]);

  // On foreground, scan for any scheduled alarms whose pre-check window is
  // currently open (the OS may have delivered the notification while the
  // app was backgrounded and we missed the listener).
  useEffect(() => {
    const handler = async (state: AppStateStatus) => {
      if (state !== 'active') return;
      const now = Date.now();
      const loaded = await loadAlarms();
      for (const a of loaded) {
        if (a.status !== 'scheduled') continue;
        const start = a.fireAt - MOTION_WINDOW_MS;
        if (now >= start && now <= a.fireAt) {
          runMotionCheck(a.id);
        }
      }
      setAlarms(loaded);
    };
    const sub = AppState.addEventListener('change', handler);
    handler(AppState.currentState);
    return () => sub.remove();
  }, [runMotionCheck]);

  const onAdd = () => setView('set');

  const onConfirm = async (hour: number, minute: number, threshold: number) => {
    try {
      await scheduleAlarm(hour, minute, threshold);
      setView('home');
      await refresh();
    } catch (e) {
      Alert.alert('Could not schedule alarm', String(e));
    }
  };

  const onCancel = async (alarm: Alarm) => {
    await cancelAlarm(alarm);
    await refresh();
  };

  const onStopRinging = async () => {
    await stopAlarm();
    setView('home');
    await refresh();
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      {view === 'home' && (
        <HomeScreen
          alarms={alarms}
          onAdd={onAdd}
          onCancel={onCancel}
          onRefresh={refresh}
          refreshing={refreshing}
        />
      )}
      {view === 'set' && (
        <SetAlarmScreen onCancel={() => setView('home')} onConfirm={onConfirm} />
      )}
      {view === 'ringing' && (
        <RingingScreen reason={ringingReason} onStop={onStopRinging} />
      )}
    </>
  );
}
