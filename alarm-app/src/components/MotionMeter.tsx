import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { subscribeLiveMotion } from '../services/motionService';

interface Props {
  threshold: number;
}

export function MotionMeter({ threshold }: Props) {
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeLiveMotion((d) => setDelta(d));
    return unsubscribe;
  }, []);

  const pct = Math.min(100, (delta / (threshold * 2)) * 100);
  const over = delta >= threshold;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Live motion: {delta.toFixed(2)} m/s²
        {over ? '  (above threshold)' : ''}
      </Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct}%`, backgroundColor: over ? '#e11d48' : '#2563eb' },
          ]}
        />
        <View style={[styles.thresholdMark, { left: '50%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  track: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: { height: '100%' },
  thresholdMark: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#0f172a',
  },
});
