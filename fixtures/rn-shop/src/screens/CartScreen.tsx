import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TrashIcon } from '../components/icons';

const noop = () => {};

// Three seeded barriers, each next to a correct twin (see expected.json).
export function CartScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text testID="screen-cart" style={styles.title} accessibilityRole="header">
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
        {/* Seeded barrier: a 16dp target squeezed next to another button (WCAG 2.5.8). */}
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
        {/* Seeded barrier: an icon-only button with no accessible name (WCAG 4.1.2). */}
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

      {/* Seeded barrier: #A3A3A3 on white is 2.5:1; text this size needs 4.5:1 (WCAG 1.4.3). */}
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
