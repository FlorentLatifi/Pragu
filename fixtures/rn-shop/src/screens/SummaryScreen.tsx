import { StyleSheet, Text, View } from 'react-native';

// Seeds for text/scaling-truncation (WCAG 1.4.4): a one-line product name and text in a
// fixed-height box. Both fit at the normal font size and are cut off at 200%. Twins: the
// same name allowed to wrap, a short one-line label that still fits, and a box that grows.
// Everything sits near the top so it stays on screen when text doubles.
export function SummaryScreen() {
  return (
    <View style={styles.screen}>
      <Text testID="screen-summary" accessibilityRole="header" style={styles.title}>
        Order summary
      </Text>

      <Text testID="seed-truncated-name" numberOfLines={1} style={styles.body}>
        Ceramic mug, sage green, 350 ml
      </Text>
      <Text testID="twin-wrapping-name" style={styles.body}>
        Ceramic mug, sage green, 350 ml
      </Text>
      <Text testID="twin-short-line" numberOfLines={1} style={styles.body}>
        Total
      </Text>

      <View style={styles.fixedBox}>
        <Text testID="seed-clipped-box-text" style={styles.caption}>
          Ships in 2–4 days
        </Text>
      </View>
      <View style={styles.growingBox}>
        <Text testID="twin-growing-box-text" style={styles.caption}>
          Ships in 2–4 days
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 64, paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: '600', color: '#1A1A18', marginBottom: 16 },
  body: { fontSize: 16, color: '#1A1A18', marginBottom: 12 },
  caption: { fontSize: 14, color: '#1A1A18' },
  fixedBox: { height: 24, overflow: 'hidden', justifyContent: 'center', marginBottom: 12 },
  growingBox: { minHeight: 24, justifyContent: 'center' },
});
