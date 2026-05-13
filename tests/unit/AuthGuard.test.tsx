/**
 * Regression tests for the vault-unlock redirect.
 *
 * The bug we're guarding against: the original guard called router.replace()
 * before the root navigator had finished mounting. The redirect raced with
 * the tabs' initial render and surfaced as
 *   "Couldn't find a navigation context. Have you wrapped your app with
 *    'NavigationContainer'?"
 *
 * The hook now waits on useRootNavigationState().key, and these tests pin
 * that contract so the regression can't return silently.
 */

import { renderHook } from '@testing-library/react-native';

// Jest hoists jest.mock() factories above imports; references must be
// prefixed with `mock` to escape the out-of-scope-variables guard.
const mockReplace = jest.fn();
const mockRouterState = {
  segments: ['login'] as string[],
  navigationKey: 'stack-key' as string | undefined,
};
const mockAuthState = {
  isAuthenticated: false,
  isVaultUnlocked: false,
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
  mockAuthState.isVaultUnlocked = false;
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

  it('keeps an authenticated-but-locked user on /login', () => {
    mockRouterState.segments = ['(tabs)'];
    mockAuthState.isAuthenticated = true;
    mockAuthState.isVaultUnlocked = false;

    renderHook(() => useAuthGuard());

    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('redirects an unlocked user from /login into /(tabs)', () => {
    mockRouterState.segments = ['login'];
    mockAuthState.isAuthenticated = true;
    mockAuthState.isVaultUnlocked = true;

    renderHook(() => useAuthGuard());

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('does not redirect an unlocked user who is already inside /(tabs)', () => {
    mockRouterState.segments = ['(tabs)'];
    mockAuthState.isAuthenticated = true;
    mockAuthState.isVaultUnlocked = true;

    renderHook(() => useAuthGuard());

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
