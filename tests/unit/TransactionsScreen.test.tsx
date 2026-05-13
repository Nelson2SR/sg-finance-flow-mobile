/**
 * Regression test for "Couldn't find a navigation context" thrown while
 * rendering the wallet/filter chips on the Transactions tab. The crash
 * happened when expo-router's Tabs navigator was rendering its children
 * before the root navigator finished registering, so any deeply nested
 * touchable that the React internals walked to would throw from
 * NavigationStateContext.
 *
 * This test renders TransactionsScreen directly inside a NavigationContainer
 * to ensure the screen can render its filter chips, vault chips, and
 * SectionList without depending on Expo Router's mount sequence.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// react-native-gesture-handler ships its own jest setup that swaps the
// native module for mocks; pull it in before importing the screen.
require('react-native-gesture-handler/jestSetup');

// expo-blur renders a native component on device; on Jest just pass through.
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

// expo-linear-gradient's native module isn't available in Jest. The visual
// gradient is irrelevant to the assertions, so swap for a plain View.
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

// Legacy Swipeable pulls native code we don't need for a render test.
jest.mock('react-native-gesture-handler/Swipeable', () => {
  const { View } = require('react-native');
  const Swipeable = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Swipeable };
});

import TransactionsScreen from '../../app/(tabs)/transactions';
import { useFinanceStore } from '../../store/useFinanceStore';

const renderInsideNav = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <NavigationContainer>
        <TransactionsScreen />
      </NavigationContainer>
    </SafeAreaProvider>,
  );

describe('TransactionsScreen — navigation context', () => {
  beforeEach(() => {
    // Reset Zustand store to defaults so each test starts deterministic.
    useFinanceStore.setState({ activeWalletId: 'w1' });
  });

  it('renders the time-filter chips without throwing a navigation-context error', () => {
    const { getByText } = renderInsideNav();
    // The filter chips are produced by `['ALL', 'WEEK', 'MONTH', 'YEAR'].map`
    // — the exact path that crashed on iOS.
    expect(getByText('History')).toBeTruthy();
    expect(getByText('This WEEK')).toBeTruthy();
    expect(getByText('This MONTH')).toBeTruthy();
    expect(getByText('This YEAR')).toBeTruthy();
  });

  it('renders the wallet chips (wallets.map) without throwing', () => {
    const { getByText } = renderInsideNav();
    // The vault chips iterate the seeded Zustand wallets. This was the
    // original line reported in the crash trace.
    expect(getByText('All Vaults')).toBeTruthy();
    expect(getByText('Bank Account')).toBeTruthy();
    expect(getByText('Japan Trip 2026')).toBeTruthy();
    expect(getByText('Family Vault')).toBeTruthy();
  });

  it('renders the empty-state copy when no transactions match the active wallet', () => {
    useFinanceStore.setState({ transactions: [], activeWalletId: 'w2' });
    const { getByText } = renderInsideNav();
    expect(getByText('No transactions match your filters.')).toBeTruthy();
  });
});
