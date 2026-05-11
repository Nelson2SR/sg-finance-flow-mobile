import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 160;

export const TrendChart = () => {
  // Mock data for 6 months: [Income, Expense]
  const data = [
    [4500, 3200], // Jan
    [5200, 4100], // Feb
    [4800, 3900], // Mar
    [6100, 4500], // Apr
    [5800, 4800], // May
    [6500, 5200], // Jun
  ];

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const maxVal = 7000;
  const barWidth = 14;
  const gap = (CHART_WIDTH - (data.length * barWidth * 2)) / (data.length + 1);

  return (
    <View className="bg-white/70 dark:bg-black/40 rounded-[24px] p-5 mb-8 border border-white/20 shadow-xl overflow-hidden">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mb-1">6-Month Momentum</Text>
          <Text className="font-jakarta text-gray-900 dark:text-white text-lg font-jakarta-bold">Cashflow Trend</Text>
        </View>
        <View className="items-end">
          <Text className="font-jakarta text-emerald-500 font-jakarta-bold text-xs">+12.4%</Text>
          <Text className="font-jakarta text-gray-400 text-[10px]">vs Prev Period</Text>
        </View>
      </View>

      <View style={{ height: CHART_HEIGHT, width: CHART_WIDTH - 40 }}>
        <Svg width={CHART_WIDTH - 40} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#469B88" />
              <Stop offset="1" stopColor="#469B8840" />
            </LinearGradient>
            <LinearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#E0533D" />
              <Stop offset="1" stopColor="#E0533D40" />
            </LinearGradient>
          </Defs>
          
          <G transform={`translate(0, ${CHART_HEIGHT})`}>
            {data.map((vals, i) => {
              const x = gap + i * (barWidth * 2 + gap);
              const incomeH = (vals[0] / maxVal) * (CHART_HEIGHT - 30);
              const expenseH = (vals[1] / maxVal) * (CHART_HEIGHT - 30);
              
              return (
                <G key={i}>
                  {/* Income Bar */}
                  <Rect
                    x={x}
                    y={-incomeH}
                    width={barWidth}
                    height={incomeH}
                    fill="url(#incomeGrad)"
                    rx={4}
                  />
                  {/* Expense Bar */}
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
          <Text key={i} className="font-jakarta text-gray-400 text-[10px] font-jakarta-bold uppercase">{m}</Text>
        ))}
      </View>
    </View>
  );
};
