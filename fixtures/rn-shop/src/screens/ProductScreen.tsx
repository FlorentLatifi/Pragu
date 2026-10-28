import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, HeartIcon, ShareIcon } from '../components/icons';

const noop = () => {};
const THUMBNAIL = require('../../assets/icon.png') as number;
// Dark stripes stand in for a photo: a busy background on which the white caption stays readable.
const PHOTO_STRIPES = ['#3B2F2A', '#2E3A34', '#4A3B32', '#3A3346', '#463A2F'];

// Seeds: 2 unlabelled icon buttons, 2 low-contrast texts, 2 crowded tiny targets.
// Twins include the tricky cases a careless checker gets wrong: large text that passes
// at 3:1, text over a busy photo, an isolated small icon (WCAG spacing exception), and a
// small icon whose hitSlop makes its real touch area 48 dp, which Pragu cannot see.
export function ProductScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <Pressable
          testID="twin-labeled-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={noop}
          style={styles.iconButton}
        >
          <BackIcon />
        </Pressable>
        <View style={styles.toolbarEnd}>
          <Pressable testID="seed-unlabeled-favorite" accessibilityRole="button" onPress={noop} style={styles.iconButton}>
            <HeartIcon />
          </Pressable>
          <Pressable testID="seed-unlabeled-share" accessibilityRole="button" onPress={noop} style={styles.iconButton}>
            <ShareIcon />
          </Pressable>
        </View>
      </View>

      <View style={styles.photo}>
        {PHOTO_STRIPES.concat(PHOTO_STRIPES, PHOTO_STRIPES, PHOTO_STRIPES, PHOTO_STRIPES, PHOTO_STRIPES).map(
          (color, index) => (
            <View key={index} style={[styles.stripe, { backgroundColor: color }]} />
          ),
        )}
        <Text testID="twin-text-on-photo" style={styles.photoCaption}>
          Hand-thrown in Prishtina
        </Text>
      </View>

      <View style={styles.badge}>
        <Text testID="seed-low-contrast-badge" style={styles.badgeText}>
          NEW
        </Text>
      </View>
      <Text testID="screen-product" accessibilityRole="header" style={styles.title}>
        Ceramic mug, speckled
      </Text>
      <Text testID="seed-low-contrast-sku" style={styles.sku}>
        SKU 4521-MG
      </Text>
      <Text testID="twin-price" style={styles.price}>
        €14.00
      </Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Quantity</Text>
        <Text style={styles.quantity}>1</Text>
        <Pressable
          testID="seed-tiny-minus"
          accessibilityRole="button"
          accessibilityLabel="Decrease quantity"
          onPress={noop}
          style={styles.stepButton}
        >
          <Text style={styles.stepGlyph}>−</Text>
        </Pressable>
        <Pressable
          testID="seed-tiny-plus"
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
          onPress={noop}
          style={[styles.stepButton, styles.stepGap]}
        >
          <Text style={styles.stepGlyph}>+</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Holds 350 ml</Text>
        <Pressable
          testID="twin-isolated-info"
          accessibilityRole="button"
          accessibilityLabel="Size guide"
          onPress={noop}
          style={styles.infoButton}
        >
          <Text style={styles.infoGlyph}>i</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Pressable testID="wishlist-open" accessibilityRole="button" onPress={noop} style={styles.wishButton}>
          <Text style={styles.wishText}>In your wishlist</Text>
        </Pressable>
        <Pressable
          testID="twin-hitslop-remove"
          accessibilityRole="button"
          accessibilityLabel="Remove from wishlist"
          hitSlop={16}
          onPress={noop}
          style={styles.hitSlopIcon}
        >
          <Text style={styles.hitSlopGlyph}>×</Text>
        </Pressable>
      </View>

      <Pressable testID="twin-text-button" accessibilityRole="button" onPress={noop} style={styles.primary}>
        <Text style={styles.primaryText}>Add to cart · €14.00</Text>
      </Pressable>

      <Text style={styles.colorsTitle}>Other colours</Text>
      <View style={styles.colors}>
        {/* Seeded barrier: TalkBack stops on this image but can only say "Image" (WCAG 1.1.1). */}
        <Image testID="seed-unnamed-image" accessible accessibilityRole="image" source={THUMBNAIL} style={styles.thumb} />
        <Image
          testID="twin-named-image"
          accessible
          accessibilityRole="image"
          accessibilityLabel="Mug in sage green"
          source={THUMBNAIL}
          style={styles.thumb}
        />
        {/* Twin: not a focus stop, so TalkBack skips it, as it should a decorative image. */}
        <Image testID="twin-decorative-image" source={THUMBNAIL} style={styles.thumb} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  colorsTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A18', marginTop: 20 },
  colors: { flexDirection: 'row', marginTop: 8 },
  thumb: { width: 64, height: 64, borderRadius: 6, marginRight: 12 },
  screen: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 56, paddingHorizontal: 20 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  toolbarEnd: { flexDirection: 'row' },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  photo: { height: 150, flexDirection: 'row', borderRadius: 6, overflow: 'hidden', marginBottom: 16 },
  stripe: { flex: 1 },
  photoCaption: { position: 'absolute', left: 16, bottom: 14, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFC94D',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  // 26 dp is large text, so 3.4:1 passes WCAG 1.4.3 (it needs 3:1).
  title: { fontSize: 26, fontWeight: '600', color: '#8A8A8A', marginTop: 8 },
  sku: { fontSize: 12, color: '#ABABAB', marginTop: 2 },
  price: { fontSize: 22, fontWeight: '600', color: '#1A1A18', marginTop: 6, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  rowLabel: { flex: 1, fontSize: 16, color: '#1A1A18' },
  quantity: { fontSize: 16, color: '#1A1A18', marginRight: 16 },
  stepButton: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1A1A18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGap: { marginLeft: 2 },
  stepGlyph: { fontSize: 14, lineHeight: 16, color: '#1A1A18' },
  infoButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A1A18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoGlyph: { fontSize: 12, lineHeight: 14, color: '#1A1A18' },
  wishButton: { flex: 1, height: 48, justifyContent: 'center' },
  wishText: { fontSize: 16, color: '#1F5E4B', fontWeight: '600' },
  // Same geometry as the cart's seeded tiny button (2 dp from a neighbour); only the invisible hitSlop differs.
  hitSlopIcon: { width: 16, height: 16, marginLeft: 2, alignItems: 'center', justifyContent: 'center' },
  hitSlopGlyph: { fontSize: 14, lineHeight: 16, color: '#1A1A18' },
  primary: {
    marginTop: 16,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#1A1A18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
