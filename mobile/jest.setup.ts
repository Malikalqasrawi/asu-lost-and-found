import { queryClient } from '@/api/query-client';

// Jest runs on Node, whose FormData turns a { uri, name, type } photo into
// "[object Object]". The app runs on React Native's, so the tests use that one.
globalThis.FormData = jest.requireActual<{ default: typeof FormData }>(
  'react-native/Libraries/Network/FormData',
).default;

// Failed requests are still retried in tests, just without waiting between tries.
queryClient.setDefaultOptions({
  queries: { ...queryClient.getDefaultOptions().queries, retryDelay: 0 },
});

afterEach(() => {
  queryClient.clear();
});
