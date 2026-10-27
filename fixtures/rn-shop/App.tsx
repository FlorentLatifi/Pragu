import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// Pragu fixture "rn-shop": one cart screen with three seeded accessibility
// barriers, each placed next to a correct twin, so the bench can measure both
// detection (seed-*) and false alarms (twin-*). Ground truth lives in
// expected.json, keyed by testID, which React Native exposes to accessibility
// tools as the view's resource id.

const noop = () => {};

// Drawn from plain views on purpose: an icon with no text gives a screen reader
// nothing to fall back on, exactly like an icon font or an SVG does.
function TrashIcon() {
  return (
    <View style={styles.trash}>
      <View style={styles.trashLid} />
      <View style={styles.trashBody} />
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Your cart
        </Text>
        <Pressable
          testID="twin-close-cart"
          accessibilityRole="button"
          accessibilityLabel="Close cart"
          onPress={noop}
          style={styles.closeButton}
        >
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>

      <View style={styles.promo}>
        <Text style={styles.promoText}>Spring sale: 20% off mugs</Text>
        <Pressable testID="promo-apply" accessibilityRole="button" onPress={noop} style={styles.applyButton}>
          <Text style={styles.applyText}>Apply code</Text>
        </Pressable>
        {/* Seeded barrier 3: a 16dp target squeezed next to another button (WCAG 2.5.8). */}
        <Pressable
          testID="seed-tiny-dismiss"
          accessibilityRole="button"
          accessibilityLabel="Dismiss promotion"
          onPress={noop}
          style={styles.tinyDismiss}
        >
          <Text style={styles.tinyGlyph}>×</Text>
        </Pressable>
      </View>

      <View style={styles.item}>
        <View style={styles.itemText}>
          <Text style={styles.itemName}>Ceramic mug</Text>
          <Text style={styles.itemPrice}>€14.00</Text>
        </View>
        {/* Seeded barrier 1: an icon-only button with no accessible name (WCAG 4.1.2). */}
        <Pressable testID="seed-unlabeled-remove" accessibilityRole="button" onPress={noop} style={styles.iconButton}>
          <TrashIcon />
        </Pressable>
      </View>

      <View style={styles.item}>
        <View style={styles.itemText}>
          <Text style={styles.itemName}>Linen tote bag</Text>
          <Text style={styles.itemPrice}>€22.00</Text>
        </View>
        <Pressable
          testID="twin-labeled-remove"
          accessibilityRole="button"
          accessibilityLabel="Remove Linen tote bag"
          onPress={noop}
          style={styles.iconButton}
        >
          <TrashIcon />
        </Pressable>
      </View>

      {/* Seeded barrier 2: #A3A3A3 on white is 2.5:1; text this size needs 4.5:1 (WCAG 1.4.3). */}
      <Text testID="seed-low-contrast" style={styles.lowContrast}>
        Free shipping on orders over €50
      </Text>
      <Text testID="twin-good-contrast" style={styles.goodContrast}>
        Delivery in 2–4 working days
      </Text>

      <Pressable testID="checkout" accessibilityRole="button" onPress={noop} style={styles.checkout}>
        <Text style={styles.checkoutText}>Checkout · €36.00</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 64, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '600', color: '#1A1A18' },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { fontSize: 28, color: '#1A1A18' },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2EFE6',
    borderRadius: 6,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    marginBottom: 16,
  },
  promoText: { flex: 1, fontSize: 14, color: '#1A1A18' },
  applyButton: { height: 48, paddingHorizontal: 14, borderRadius: 6, backgroundColor: '#1F5E4B', justifyContent: 'center' },
  applyText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  tinyDismiss: { width: 16, height: 16, marginLeft: 2, alignItems: 'center', justifyContent: 'center' },
  tinyGlyph: { fontSize: 12, lineHeight: 14, color: '#1A1A18' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E2DC',
  },
  itemText: { flex: 1 },
  itemName: { fontSize: 16, color: '#1A1A18' },
  itemPrice: { fontSize: 14, color: '#5E5C57', marginTop: 2 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  trash: { alignItems: 'center' },
  trashLid: { width: 18, height: 3, borderRadius: 1, backgroundColor: '#1A1A18', marginBottom: 2 },
  trashBody: {
    width: 14,
    height: 16,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: '#1A1A18',
  },
  lowContrast: { fontSize: 14, color: '#A3A3A3', marginTop: 20 },
  goodContrast: { fontSize: 14, color: '#595959', marginTop: 8 },
  checkout: {
    marginTop: 28,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#1A1A18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
