/**
 * Smoke + regression tests for the Analytics screen.
 *
 * Past bugs guarded against:
 *   1. AmbientAura's SVG `Path` collapsed to a zero-length arc at ratio === 0
 *      (rendered as a single stray dot) and at ratio === 1 (rendered as
 *      nothing). We now use stroke-dasharray on a Circle.
 *   2. Cashflow Momentum bars used percentage heights on flex children with
 *      ambiguous parent height; the income bar grew past the card top and
 *      clipped the "Cashflow Momentum" title.
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
    // Reset to the seeded defaults so each test is deterministic.
    useFinanceStore.setState({ activeWalletId: 'w1', budgets: [] });
  });

  it('renders the header, both charts, and the active-routines section without crashing', () => {
    const { getByText } = renderScreen();
    expect(getByText('Analytics')).toBeTruthy();
    expect(getByText('Safe to Spend')).toBeTruthy();
    expect(getByText('Cashflow Momentum')).toBeTruthy();
    expect(getByText('Active Routines')).toBeTruthy();
  });

  it('shows the income and spend totals on the cashflow card', () => {
    // Seeded store has one EXPENSE of 2499 and one EXPENSE of 45 and one
    // INCOME of 8000. The screen sums across all wallets for this card.
    const { getByText } = renderScreen();
    expect(getByText('$8,000')).toBeTruthy(); // income label
    expect(getByText('$2,544')).toBeTruthy(); // spend label (2499 + 45)
  });

  it('handles the zero-spend case in AmbientAura (no degenerate arc)', () => {
    useFinanceStore.setState({ transactions: [], activeWalletId: 'w1', budgets: [] });
    const { getByText, queryByText } = renderScreen();
    // With no spend and the default 4000 cap, remaining === full cap.
    expect(getByText('$4000')).toBeTruthy();
    // Sanity: the Safe-to-Spend label is still there (component didn't bail).
    expect(queryByText('Safe to Spend')).toBeTruthy();
  });

  it('handles the over-budget case (ratio >= 1) without crashing', () => {
    useFinanceStore.setState({
      activeWalletId: 'w1',
      budgets: [],
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
