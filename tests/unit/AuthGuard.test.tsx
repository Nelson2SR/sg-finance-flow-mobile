/**
 * Regression tests for the auth redirect flow.
 *
 * The bug we're guarding against: the original guard called router.replace()
 * before the root navigator had finished mounting. The redirect raced with
 * the tabs' initial render and surfaced as
 *   "Couldn't find a navigation context. Have you wrapped your app with
 *    'NavigationContainer'?"
 *
 * The hook now waits on useRootNavigationState().key, and these tests pin
 * that contract so the regression can't return silently.
 *
 * Post-PR-2 the only gate is `isAuthenticated` — the separate
 * `isVaultUnlocked` state is gone with the vault passphrase.
 */

import { renderHook } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockRouterState = {
  segments: ['login'] as string[],
  navigationKey: 'stack-key' as string | undefined,
};
const mockAuthState = {
  isAuthenticated: false,
  isLoading: false,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockRouterState.segments,
  useRootNavigationState: () => ({ key: mockRouterState.navigationKey }),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

import { useAuthGuard } from '../../components/AuthGuard';

const resetState = () => {
  mockReplace.mockReset();
  mockRouterState.segments = ['login'];
  mockRouterState.navigationKey = 'stack-key';
  mockAuthState.isAuthenticated = false;
  mockAuthState.isLoading = false;
};

describe('useAuthGuard redirect flow', () => {
  beforeEach(resetState);

  it('does not redirect while the root navigator is not yet mounted', () => {
    mockRouterState.navigationKey = undefined;
    mockRouterState.segments = ['(tabs)'];

    renderHook(() => useAuthGuard());

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect while auth state is still loading', () => {
    mockAuthState.isLoading = true;
    mockRouterState.segments = ['(tabs)'];

    renderHook(() => useAuthGuard());

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects an unauthenticated user from /(tabs) to /login', () => {
    mockRouterState.segments = ['(tabs)'];
    mockAuthState.isAuthenticated = false;

    renderHook(() => useAuthGuard());

    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('redirects an authenticated user from /login into /(tabs)', () => {
    mockRouterState.segments = ['login'];
    mockAuthState.isAuthenticated = true;

    renderHook(() => useAuthGuard());

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('does not redirect an authenticated user who is already inside /(tabs)', () => {
    mockRouterState.segments = ['(tabs)'];
    mockAuthState.isAuthenticated = true;

    renderHook(() => useAuthGuard());

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
