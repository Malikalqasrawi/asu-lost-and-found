import { act, renderHook } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';

import { loadAppearance, setAppearance, useAppearance } from '@/hooks/use-appearance';

const { resetSecureStore } = SecureStore as unknown as { resetSecureStore: () => void };

describe('appearance', () => {
  let setScheme: jest.SpyInstance;

  beforeEach(async () => {
    await setAppearance('system');
    resetSecureStore();
    setScheme = jest.spyOn(Appearance, 'setColorScheme');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies the look saved on this phone at start-up', async () => {
    await SecureStore.setItemAsync('appearance', 'light');

    await loadAppearance();

    expect(setScheme).toHaveBeenLastCalledWith('light');
    const { result } = await renderHook(() => useAppearance());
    expect(result.current).toBe('light');
  });

  it('keeps following the phone when the saved value is unknown', async () => {
    await SecureStore.setItemAsync('appearance', 'sepia');

    await loadAppearance();

    expect(setScheme).not.toHaveBeenCalled();
    const { result } = await renderHook(() => useAppearance());
    expect(result.current).toBe('system');
  });

  it('starts normally when the saved choice cannot be read', async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('Keystore locked'));

    await expect(loadAppearance()).resolves.toBeUndefined();

    expect(setScheme).not.toHaveBeenCalled();
  });

  it('updates every screen that shows the choice', async () => {
    const { result } = await renderHook(() => useAppearance());

    await act(() => setAppearance('dark'));

    expect(result.current).toBe('dark');
  });
});
