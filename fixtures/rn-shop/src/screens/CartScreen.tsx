import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CloseIcon, TrashIcon } from '../components/icons';

const noop = () => {};

// A confirmation dialog in its own window (React Native's Modal). Its barriers count;
// the cart's barriers behind it must not, because nobody can act on them while it is open.
function RemoveDialog() {
  return (
    <Modal transparent animationType="none" visible onRequestClose={noop}>
      <View style={styles.scrim}>
        <View style={styles.dialog}>
          <View style={styles.dialogHeader}>
            <Text testID="screen-cart-dialog" accessibilityRole="header" style={styles.dialogTitle}>
              Remove Ceramic mug?
            </Text>
            {/* Seeded barrier: an icon-only close button with no name, inside the dialog. */}
            <Pressable
              testID="seed-dialog-unlabeled-close"
              accessibilityRole="button"
              onPress={noop}
              style={styles.iconButton}
            >
              <CloseIcon />
            </Pressable>
          </View>
          {/* Seeded barrier: #AAAAAA on white is 2.3:1. */}
          <Text testID="seed-dialog-low-contrast" style={styles.dialogCaption}>
            You can add it again later.
          </Text>
          <View style={styles.dialogActions}>
            <Pressable testID="twin-dialog-keep" accessibilityRole="button" onPress={noop} style={styles.dialogButton}>
              <Text style={styles.dialogKeepText}>Keep it</Text>
            </Pressable>
            <Pressable
              testID="twin-dialog-remove"
              accessibilityRole="button"
              onPress={noop}
              style={[styles.dialogButton, styles.dialogRemove]}
            >
              <Text style={styles.dialogRemoveText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Seeded barriers, each next to a correct twin (see expected.json).
export function CartScreen({ confirmRemove = false }: { confirmRemove?: boolean }) {
  const [giftWrap, setGiftWrap] = useState(true);
  const [giftReceipt, setGiftReceipt] = useState(false);
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

      {/* Seeded barrier: it says it is a checkbox but never whether it is checked (WCAG 4.1.2). */}
      <Pressable
        testID="seed-stateless-checkbox"
        accessibilityRole="checkbox"
        onPress={() => setGiftWrap(!giftWrap)}
        style={styles.option}
      >
        <View style={styles.box}>{giftWrap ? <View style={styles.boxMark} /> : null}</View>
        <Text style={styles.optionText}>Gift wrap this order</Text>
      </Pressable>
      <Pressable
        testID="twin-stateful-checkbox"
        accessibilityRole="checkbox"
        aria-checked={giftReceipt}
        onPress={() => setGiftReceipt(!giftReceipt)}
        style={styles.option}
      >
        <View style={styles.box}>{giftReceipt ? <View style={styles.boxMark} /> : null}</View>
        <Text style={styles.optionText}>Add a gift receipt</Text>
      </Pressable>

      <Pressable testID="checkout" accessibilityRole="button" onPress={noop} style={styles.checkout}>
        <Text style={styles.checkoutText}>Checkout · €36.00</Text>
      </Pressable>
      {confirmRemove ? <RemoveDialog /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26, 26, 24, 0.5)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#FFFFFF', borderRadius: 6, padding: 20 },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dialogTitle: { flex: 1, fontSize: 20, fontWeight: '600', color: '#1A1A18' },
  dialogCaption: { fontSize: 14, color: '#AAAAAA', marginTop: 4 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  dialogButton: { height: 48, paddingHorizontal: 16, borderRadius: 6, justifyContent: 'center' },
  dialogRemove: { backgroundColor: '#A8432F', marginLeft: 8 },
  dialogKeepText: { fontSize: 16, fontWeight: '600', color: '#1A1A18' },
  dialogRemoveText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
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
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 48, marginTop: 8 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1A1A18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxMark: { width: 12, height: 12, borderRadius: 2, backgroundColor: '#1F5E4B' },
  optionText: { flex: 1, fontSize: 16, color: '#1A1A18', marginLeft: 12 },
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
