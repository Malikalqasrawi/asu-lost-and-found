import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

export type AppearanceChoice = 'system' | 'light' | 'dark';

const KEY = 'appearance';

let choice: AppearanceChoice = 'system';
const listeners = new Set<() => void>();

/** Every useColorScheme() in the app, navigation included, follows this. */
function apply(next: AppearanceChoice): void {
  choice = next;
  Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  listeners.forEach((listener) => listener());
}

/** Applies the choice saved on this phone; called once at start-up. */
export async function loadAppearance(): Promise<void> {
  const saved = await SecureStore.getItemAsync(KEY).catch(() => null);
  if (saved === 'light' || saved === 'dark') {
    apply(saved);
  }
}

export async function setAppearance(next: AppearanceChoice): Promise<void> {
  apply(next);
  if (next === 'system') {
    await SecureStore.deleteItemAsync(KEY);
  } else {
    await SecureStore.setItemAsync(KEY, next);
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppearance(): AppearanceChoice {
  return useSyncExternalStore(subscribe, () => choice);
}
