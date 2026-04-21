import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MotionMeter } from '../components/MotionMeter';
import { DEFAULT_MOTION_THRESHOLD } from '../types';

interface Props {
  onCancel: () => void;
  onConfirm: (hour: number, minute: number, motionThreshold: number) => void;
}

export function SetAlarmScreen({ onCancel, onConfirm }: Props) {
  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });
  const [threshold, setThreshold] = useState(DEFAULT_MOTION_THRESHOLD);
  const [pickerOpen, setPickerOpen] = useState(Platform.OS === 'ios');

  const onChangeTime = (_e: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setPickerOpen(false);
    if (selected) setTime(selected);
  };

  const confirm = () => {
    if (!Number.isFinite(threshold) || threshold <= 0) {
      Alert.alert('Invalid threshold', 'Motion threshold must be a positive number.');
      return;
    }
    onConfirm(time.getHours(), time.getMinutes(), threshold);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>New Alarm</Text>
      <Text style={styles.label}>Alarm time</Text>

      {Platform.OS === 'android' && (
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setPickerOpen(true)}>
          <Text style={styles.pickerBtnText}>
            {String(time.getHours()).padStart(2, '0')}:
            {String(time.getMinutes()).padStart(2, '0')}
          </Text>
        </TouchableOpacity>
      )}
      {pickerOpen && (
        <DateTimePicker
          value={time}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChangeTime}
        />
      )}

      <Text style={[styles.label, { marginTop: 24 }]}>
        Motion threshold: {threshold.toFixed(2)} m/s²
      </Text>
      <Text style={styles.help}>
        Peak acceleration (gravity-subtracted) over the 10s window at or above
        this value counts as “user is moving” and skips the alarm.
      </Text>
      <View style={styles.thresholdRow}>
        {[0.6, 1.2, 2.0, 3.0].map((v) => (
          <TouchableOpacity
            key={v}
            onPress={() => setThreshold(v)}
            style={[
              styles.chip,
              Math.abs(threshold - v) < 0.01 && styles.chipActive,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                Math.abs(threshold - v) < 0.01 && styles.chipTextActive,
              ]}
            >
              {v.toFixed(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <MotionMeter threshold={threshold} />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmBtn} onPress={confirm}>
          <Text style={styles.confirmText}>Set Alarm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, paddingTop: 56, backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 24 },
  label: { fontSize: 14, color: '#475569', fontWeight: '600', marginBottom: 6 },
  help: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  pickerBtn: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  pickerBtnText: { fontSize: 24, fontWeight: '600', color: '#0f172a' },
  thresholdRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  cancelText: { color: '#475569', fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontWeight: '700' },
});
