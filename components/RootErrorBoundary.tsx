/**
 * RootErrorBoundary — catches uncaught JS exceptions anywhere in the
 * render tree and shows a recoverable error screen instead of a
 * white screen of death.
 *
 * The shape of the fallback intentionally avoids any of our themed
 * components (`Surface`, `GradientCard`, etc.) — if the theme system
 * itself is what crashed, the error UI shouldn't crash too. Plain
 * `View` + hex literals, dark background so a light-mode JS error
 * doesn't blind the user.
 *
 * In production, log the error so we can capture it in Sentry /
 * Crashlytics once that's wired up (see ACTION_ITEMS § P2 QA2).
 */

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Surface in dev so React Native's LogBox catches it too; in
    // production this is the hook to forward to Sentry / Crashlytics.
    if (__DEV__) {
      console.warn('[RootErrorBoundary] uncaught error', error, errorInfo);
    }
    this.setState({ errorInfo });
  }

  private reset = (): void => {
    this.setState({ error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0B0E14',
          paddingHorizontal: 24,
          paddingTop: 80,
          paddingBottom: 40,
        }}>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 92, 124, 0.2)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20,
            }}>
            <Ionicons name="warning" size={36} color="#FF5C7C" />
          </View>
          <Text
            style={{
              color: '#F2F4F8',
              fontSize: 24,
              fontWeight: '700',
              marginBottom: 8,
              textAlign: 'center',
            }}>
            Something went wrong
          </Text>
          <Text
            style={{
              color: 'rgba(242, 244, 248, 0.6)',
              fontSize: 14,
              lineHeight: 20,
              textAlign: 'center',
            }}>
            The app hit an unexpected error. Your data is safe — tap
            Reset to return to the home screen.
          </Text>
        </View>

        {/* Dev-only error detail so we can debug without leaving the
            screen. Hidden in release builds because Apple specifically
            calls out exposing raw stack traces as a bad practice. */}
        {__DEV__ && (
          <ScrollView
            style={{
              flex: 1,
              backgroundColor: 'rgba(255, 92, 124, 0.08)',
              borderRadius: 16,
              padding: 16,
              marginBottom: 20,
              maxHeight: 280,
            }}>
            <Text
              style={{
                color: '#FF5C7C',
                fontFamily: 'Courier',
                fontSize: 11,
                marginBottom: 8,
              }}>
              {error.name}: {error.message}
            </Text>
            <Text
              style={{
                color: 'rgba(242, 244, 248, 0.7)',
                fontFamily: 'Courier',
                fontSize: 10,
              }}>
              {error.stack ?? '(no stack)'}
            </Text>
            {errorInfo?.componentStack && (
              <Text
                style={{
                  color: 'rgba(242, 244, 248, 0.5)',
                  fontFamily: 'Courier',
                  fontSize: 10,
                  marginTop: 12,
                }}>
                {errorInfo.componentStack}
              </Text>
            )}
          </ScrollView>
        )}

        <Pressable
          onPress={this.reset}
          style={{
            backgroundColor: '#FF6B4A',
            paddingVertical: 16,
            borderRadius: 999,
            alignItems: 'center',
            boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)' as any,
          }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            Reset
          </Text>
        </Pressable>
      </View>
    );
  }
}
