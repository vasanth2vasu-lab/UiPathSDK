import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';

interface Props {
  reason: string;
  onStop: () => void;
}

export function RingingScreen({ reason, onStop }: Props) {
  useKeepAwake();

  useEffect(() => {
    const pattern = [0, 800, 400, 800];
    Vibration.vibrate(pattern, true);
    return () => Vibration.cancel();
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.big}>⏰</Text>
      <Text style={styles.title}>Wake up!</Text>
      <Text style={styles.meta}>{reason}</Text>
      <TouchableOpacity style={styles.stopBtn} onPress={onStop}>
        <Text style={styles.stopText}>STOP</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#e11d48',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  big: { fontSize: 80 },
  title: { fontSize: 36, color: '#fff', fontWeight: '800', marginTop: 12 },
  meta: { color: '#fecdd3', marginTop: 8, textAlign: 'center' },
  stopBtn: {
    marginTop: 48,
    backgroundColor: '#fff',
    paddingHorizontal: 48,
    paddingVertical: 20,
    borderRadius: 999,
  },
  stopText: { fontSize: 22, fontWeight: '800', color: '#e11d48' },
});
