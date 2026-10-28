import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

const noop = () => {};

// Seeds: a field labelled only by a pale placeholder, a field whose visible label is not
// connected to it, and a home-made checkbox with no name, no role and no state. Twins: a
// labelled field, a field connected to its visible label with aria-labelledby, a labelled
// switch, and a disabled button whose grey text WCAG exempts from contrast.
export function FormScreen() {
  const [subscribed, setSubscribed] = useState(false);
  const [saveDetails, setSaveDetails] = useState(true);
  return (
    <View style={styles.screen}>
      <Text testID="screen-form" accessibilityRole="header" style={styles.title}>
        Delivery details
      </Text>

      <Text style={styles.label}>Full name</Text>
      <TextInput
        testID="twin-labelled-name"
        accessibilityLabel="Full name"
        placeholder="Florent Latifi"
        placeholderTextColor="#6B6963"
        style={styles.input}
      />
      <TextInput
        testID="seed-placeholder-only"
        placeholder="Email address"
        placeholderTextColor="#B0B0B0"
        style={styles.input}
      />

      <Text style={styles.label}>Promo code</Text>
      <TextInput testID="seed-unlabeled-input" style={styles.input} />

      <Text nativeID="gift-card-label" style={styles.label}>
        Gift card number
      </Text>
      <TextInput testID="twin-labelledby-input" aria-labelledby="gift-card-label" style={styles.input} />

      <View style={styles.row}>
        <Pressable testID="seed-unlabeled-checkbox" onPress={() => setSubscribed(!subscribed)} style={styles.checkbox}>
          {subscribed ? <View style={styles.checkMark} /> : null}
        </Pressable>
        <Text style={styles.rowText}>Email me about new pieces</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowText}>Save my details</Text>
        <Switch
          testID="twin-labeled-switch"
          accessibilityLabel="Save my details"
          value={saveDetails}
          onValueChange={setSaveDetails}
        />
      </View>

      <Pressable
        testID="twin-disabled-labeled"
        accessibilityRole="button"
        disabled
        onPress={noop}
        style={styles.secondary}
      >
        <Text testID="twin-disabled-text" style={styles.secondaryText}>
          Use saved address
        </Text>
      </Pressable>
      <Pressable testID="twin-continue" accessibilityRole="button" onPress={noop} style={styles.primary}>
        <Text style={styles.primaryText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 64, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '600', color: '#1A1A18', marginBottom: 20 },
  label: { fontSize: 14, color: '#1A1A18', marginBottom: 4 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#8C8A84',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1A1A18',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, marginBottom: 8 },
  rowText: { flex: 1, fontSize: 16, color: '#1A1A18', marginLeft: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1A1A18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { width: 12, height: 12, borderRadius: 2, backgroundColor: '#1F5E4B' },
  secondary: {
    marginTop: 16,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#F0EFEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 16, color: '#9C9C9C' },
  primary: {
    marginTop: 12,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#1A1A18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
