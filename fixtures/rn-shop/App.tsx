import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { CartScreen } from './src/screens/CartScreen';
import { FormScreen } from './src/screens/FormScreen';
import { ProductScreen } from './src/screens/ProductScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';

// Pragu fixture "rn-shop". Each screen seeds accessibility barriers next to correct
// twins. Pragu Bench opens a screen by deep link (rnshop://cart, rnshop://cart?dialog=remove,
// rnshop://product, rnshop://form, rnshop://summary) and checks the scan against expected.json, keyed by testID.

interface Route {
  screen: 'cart' | 'product' | 'form' | 'summary';
  dialog: boolean;
}

function routeFromUrl(url: string | null | undefined): Route {
  const path = url?.replace(/^rnshop:\/\//, '') ?? '';
  const name = path.split(/[/?#]/)[0];
  return {
    screen: name === 'product' || name === 'form' || name === 'summary' ? name : 'cart',
    dialog: /[?&]dialog=remove(&|$)/.test(path),
  };
}

function Screen({ route }: { route: Route }) {
  switch (route.screen) {
    case 'product':
      return <ProductScreen />;
    case 'form':
      return <FormScreen />;
    case 'summary':
      return <SummaryScreen />;
    default:
      return <CartScreen confirmRemove={route.dialog} />;
  }
}

export default function App() {
  // Nothing renders until the launch URL is known, so a capture never sees the wrong screen.
  const [route, setRoute] = useState<Route | null>(null);

  useEffect(() => {
    void Linking.getInitialURL().then((url) => setRoute(routeFromUrl(url)));
    const subscription = Linking.addEventListener('url', ({ url }) => setRoute(routeFromUrl(url)));
    return () => subscription.remove();
  }, []);

  if (route === null) return null;
  return (
    <>
      <StatusBar style="dark" />
      <Screen route={route} />
    </>
  );
}
