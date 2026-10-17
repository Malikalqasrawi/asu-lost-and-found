/** Which parts of the app may import which. Run with `npm run lint:layers`. */
const LOGIC = '^src/(api|session|media|constants|hooks)/';

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Files that import each other in a loop are hard to change and to test.',
      from: {},
      to: { circular: true, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'screens-on-top',
      severity: 'error',
      comment: 'Only the router uses screens; everything else is used by screens.',
      from: { pathNot: '^src/app/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'logic-without-ui',
      severity: 'error',
      comment: 'API calls, the session, photo handling and hooks work without any components.',
      from: { path: LOGIC },
      to: { path: '^src/components/' },
    },
    {
      name: 'constants-are-plain',
      severity: 'error',
      comment: 'Labels and theme values may share types, but never call into the rest of the app.',
      from: { path: '^src/constants/' },
      to: { path: '^src/', pathNot: '^src/constants/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'no-tests-in-app',
      severity: 'error',
      comment: 'Application code never imports tests or test helpers.',
      from: { path: '^src/', pathNot: '^src/test/' },
      to: { path: '^src/test/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js'] },
  },
};
