/**
 * Smoke + regression tests for the Analytics screen.
 *
 * Past bugs guarded against:
 *   1. AmbientAura's SVG `Path` collapsed to a zero-length arc at ratio === 0
 *      (rendered as a single stray dot) and at ratio === 1 (rendered as
 *      nothing). We now use stroke-dasharray on a Circle.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

require('react-native-gesture-handler/jestSetup');

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

// expo-linear-gradient's native module isn't available in Jest. Swap for a
// View so <Surface> and <GradientCard> can render in the test renderer.
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

import AnalyticsScreen from '../../app/(tabs)/analytics';
import { useFinanceStore } from '../../store/useFinanceStore';

const renderScreen = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <NavigationContainer>
        <AnalyticsScreen />
      </NavigationContainer>
    </SafeAreaProvider>,
  );

describe('AnalyticsScreen', () => {
  beforeEach(() => {
    // Start every test from the brand-new-user baseline: no wallets,
    // no budgets, no transactions. Individual tests opt into whatever
    // state they actually exercise.
    useFinanceStore.setState({
      activeWalletId: null,
      wallets: [],
      budgets: [],
      transactions: [],
    });
  });

  it('renders header + active-routines for the empty-state user on the Budget tab', () => {
    const { getByText } = renderScreen();
    expect(getByText('Analytics')).toBeTruthy();
    expect(getByText('Active Routines')).toBeTruthy();
    // Empty-state CTA replaces the aura until a budget is created.
    expect(getByText('No budgets yet')).toBeTruthy();
  });

  it('shows the AmbientAura with the budget cap when at least one budget exists', () => {
    useFinanceStore.setState({
      activeWalletId: 'w1',
      budgets: [{
        id: 'b1', name: 'Monthly', amount: 4000, wallets: 'ALL',
        currency: 'SGD', recurrence: 'MONTHLY', categories: [],
      }],
      transactions: [],
    });
    const { getByText } = renderScreen();
    // No spend → remaining === full cap (formatted with no thousands sep).
    expect(getByText('$4000')).toBeTruthy();
    expect(getByText('Safe to Spend')).toBeTruthy();
  });

  it('handles the over-budget case (ratio >= 1) without crashing', () => {
    useFinanceStore.setState({
      activeWalletId: 'w1',
      budgets: [{
        id: 'b1', name: 'Monthly', amount: 4000, wallets: 'ALL',
        currency: 'SGD', recurrence: 'MONTHLY', categories: [],
      }],
      transactions: [
        { id: 't1', walletId: 'w1', type: 'EXPENSE', amount: 9999, category: 'Test', merchant: 'X', date: new Date() },
      ],
    });
    const { getAllByText, getByText } = renderScreen();
    // remaining clamps to 0 (one "$0" in the aura, another for income total)
    expect(getAllByText('$0').length).toBeGreaterThanOrEqual(1);
    // total spend shows the full overshoot
    expect(getByText('$9,999')).toBeTruthy();
  });
});
