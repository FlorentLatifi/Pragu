import { StyleSheet, View } from 'react-native';

// Icons are drawn from plain views on purpose: an icon with no text gives a screen
// reader nothing to fall back on, exactly like an icon font or an SVG does.

export function TrashIcon() {
  return (
    <View style={styles.trash}>
      <View style={styles.trashLid} />
      <View style={styles.trashBody} />
    </View>
  );
}

export function HeartIcon() {
  return <View style={styles.heart} />;
}

export function ShareIcon() {
  return (
    <View style={styles.share}>
      <View style={styles.shareDot} />
      <View style={styles.shareDot} />
      <View style={styles.shareDot} />
    </View>
  );
}

export function BackIcon() {
  return <View style={styles.back} />;
}

export function CloseIcon() {
  return (
    <View style={styles.close}>
      <View style={[styles.closeBar, styles.closeBarDown]} />
      <View style={[styles.closeBar, styles.closeBarUp]} />
    </View>
  );
}

const styles = StyleSheet.create({
  close: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  closeBar: { position: 'absolute', width: 20, height: 3, borderRadius: 1, backgroundColor: '#1A1A18' },
  closeBarDown: { transform: [{ rotate: '45deg' }] },
  closeBarUp: { transform: [{ rotate: '-45deg' }] },
  trash: { alignItems: 'center' },
  trashLid: { width: 18, height: 3, borderRadius: 1, backgroundColor: '#1A1A18', marginBottom: 2 },
  trashBody: {
    width: 14,
    height: 16,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: '#1A1A18',
  },
  heart: { width: 18, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#1A1A18' },
  share: { width: 20, height: 20, justifyContent: 'space-between', alignItems: 'center' },
  shareDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1A1A18' },
  back: {
    width: 14,
    height: 14,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#1A1A18',
    transform: [{ rotate: '45deg' }],
  },
});
