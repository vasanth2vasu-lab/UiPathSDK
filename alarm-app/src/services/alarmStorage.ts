import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Alarm } from '../types';

const KEY = 'smart-motion-alarm:alarms';

export async function loadAlarms(): Promise<Alarm[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Alarm[];
  } catch {
    return [];
  }
}

export async function saveAlarms(alarms: Alarm[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(alarms));
}

export async function upsertAlarm(alarm: Alarm): Promise<Alarm[]> {
  const alarms = await loadAlarms();
  const idx = alarms.findIndex((a) => a.id === alarm.id);
  if (idx >= 0) alarms[idx] = alarm;
  else alarms.push(alarm);
  await saveAlarms(alarms);
  return alarms;
}

export async function removeAlarm(id: string): Promise<Alarm[]> {
  const alarms = (await loadAlarms()).filter((a) => a.id !== id);
  await saveAlarms(alarms);
  return alarms;
}

export async function getAlarm(id: string): Promise<Alarm | undefined> {
  return (await loadAlarms()).find((a) => a.id === id);
}
