import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { Linking } from 'react-native';
import { CartScreen } from './src/screens/CartScreen';
import { FormScreen } from './src/screens/FormScreen';
import { ProductScreen } from './src/screens/ProductScreen';

// Pragu fixture "rn-shop". Each screen seeds accessibility barriers next to correct
// twins. Pragu Bench opens a screen by deep link (rnshop://cart, rnshop://product,
// rnshop://form) and checks the scan against expected.json, keyed by testID.

const SCREENS = { cart: CartScreen, product: ProductScreen, form: FormScreen } satisfies Record<string, ComponentType>;
type ScreenId = keyof typeof SCREENS;

function screenFromUrl(url: string | null | undefined): ScreenId {
  const name = url?.replace(/^rnshop:\/\//, '').split(/[/?#]/)[0];
  return name === 'product' || name === 'form' ? name : 'cart';
}

export default function App() {
  // Nothing renders until the launch URL is known, so a capture never sees the wrong screen.
  const [screen, setScreen] = useState<ScreenId | null>(null);

  useEffect(() => {
    void Linking.getInitialURL().then((url) => setScreen(screenFromUrl(url)));
    const subscription = Linking.addEventListener('url', ({ url }) => setScreen(screenFromUrl(url)));
    return () => subscription.remove();
  }, []);

  if (screen === null) return null;
  const Screen = SCREENS[screen];
  return (
    <>
      <StatusBar style="dark" />
      <Screen />
    </>
  );
}
