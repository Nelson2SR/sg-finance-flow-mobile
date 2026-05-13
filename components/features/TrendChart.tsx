import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { GradientCard } from '../ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 160;

export const TrendChart = () => {
  const data = [
    [4500, 3200],
    [5200, 4100],
    [4800, 3900],
    [6100, 4500],
    [5800, 4800],
    [6500, 5200],
  ];

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const maxVal = 7000;
  const barWidth = 14;
  // Drawing area inside the card. CHART_WIDTH is screen width minus the
  // outer screen padding (px-6 × 2 = 48); subtract another 48 for the
  // GradientCard's p-6 inner padding to get the SVG draw width. Pair
  // width includes the 4px micro-gap between income and expense bars
  // within a pair; forgetting that pushed JUN's expense bar past the
  // right edge.
  const SVG_WIDTH = CHART_WIDTH - 48;
  const pairWidth = barWidth * 2 + 4;
  const gap = (SVG_WIDTH - data.length * pairWidth) / (data.length + 1);

  return (
    <GradientCard padding="lg" className="mb-8 overflow-hidden">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
            6-Month Momentum
          </Text>
          <Text className="font-jakarta-bold text-text-high text-lg">Cashflow Trend</Text>
        </View>
        <View className="items-end">
          <Text className="font-jakarta-bold text-accent-mint text-xs">+12.4%</Text>
          <Text className="font-jakarta text-text-low text-[10px]">vs Prev Period</Text>
        </View>
      </View>

      <View style={{ height: CHART_HEIGHT, width: SVG_WIDTH }}>
        <Svg width={SVG_WIDTH} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#5BE0B0" />
              <Stop offset="1" stopColor="#5BE0B033" />
            </LinearGradient>
            <LinearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FF5C7C" />
              <Stop offset="1" stopColor="#FF5C7C33" />
            </LinearGradient>
          </Defs>

          <G transform={`translate(0, ${CHART_HEIGHT})`}>
            {data.map((vals, i) => {
              const x = gap + i * (pairWidth + gap);
              const incomeH = (vals[0] / maxVal) * (CHART_HEIGHT - 30);
              const expenseH = (vals[1] / maxVal) * (CHART_HEIGHT - 30);

              return (
                <G key={i}>
                  <Rect x={x} y={-incomeH} width={barWidth} height={incomeH} fill="url(#incomeGrad)" rx={4} />
                  <Rect
                    x={x + barWidth + 4}
                    y={-expenseH}
                    width={barWidth}
                    height={expenseH}
                    fill="url(#expenseGrad)"
                    rx={4}
                  />
                </G>
              );
            })}
          </G>
        </Svg>
      </View>

      <View className="flex-row justify-between mt-4 px-2">
        {months.map((m, i) => (
          <Text key={i} className="font-jakarta-bold text-text-low text-[10px] uppercase">
            {m}
          </Text>
        ))}
      </View>
    </GradientCard>
  );
};
