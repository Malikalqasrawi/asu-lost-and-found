import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import { setAccessToken } from '@/api/client';

beforeEach(() => {
  setAccessToken(null);
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  cleanup();
});
