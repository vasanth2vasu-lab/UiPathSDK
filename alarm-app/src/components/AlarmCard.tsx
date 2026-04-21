import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Alarm } from '../types';

interface Props {
  alarm: Alarm;
  onCancel: (a: Alarm) => void;
}

function fmt(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function countdown(fireAt: number): string {
  const ms = fireAt - Date.now();
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `in ${hours}h ${rem}m`;
}

const statusColor: Record<Alarm['status'], string> = {
  scheduled: '#2563eb',
  ringing: '#e11d48',
  skipped: '#16a34a',
  done: '#64748b',
  cancelled: '#64748b',
};

export function AlarmCard({ alarm, onCancel }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.time}>{fmt(alarm.hour, alarm.minute)}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor[alarm.status] }]}>
          <Text style={styles.badgeText}>{alarm.status}</Text>
        </View>
      </View>
      {alarm.status === 'scheduled' && (
        <Text style={styles.meta}>Rings {countdown(alarm.fireAt)}</Text>
      )}
      {alarm.resolutionReason && (
        <Text style={styles.meta}>{alarm.resolutionReason}</Text>
      )}
      <Text style={styles.meta}>Motion threshold: {alarm.motionThreshold.toFixed(2)} m/s²</Text>
      {alarm.status === 'scheduled' && (
        <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(alarm)}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: 28, fontWeight: '600', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  meta: { color: '#64748b', fontSize: 13, marginTop: 4 },
  cancelBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelText: { color: '#475569', fontSize: 13 },
});
