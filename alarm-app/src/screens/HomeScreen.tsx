import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import type { Alarm } from '../types';
import { AlarmCard } from '../components/AlarmCard';

interface Props {
  alarms: Alarm[];
  onAdd: () => void;
  onCancel: (a: Alarm) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function HomeScreen({ alarms, onAdd, onCancel, onRefresh, refreshing }: Props) {
  const scheduled = alarms.filter((a) => a.status === 'scheduled');
  const history = alarms.filter((a) => a.status !== 'scheduled');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Smart Motion Alarm</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {scheduled.length === 0 && (
          <Text style={styles.empty}>No alarms scheduled. Tap “+ Add” to set one.</Text>
        )}
        {scheduled.map((a) => (
          <AlarmCard key={a.id} alarm={a} onCancel={onCancel} />
        ))}

        {history.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Recent</Text>
            {history
              .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
              .slice(0, 10)
              .map((a) => (
                <AlarmCard key={a.id} alarm={a} onCancel={onCancel} />
              ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  addBtn: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '600' },
  list: { flex: 1 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
