/** Which parts of the admin website may import which. Run with `npm run lint:layers`. */
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
      name: 'pages-on-top',
      severity: 'error',
      comment: 'Only the app shell uses pages; everything else is used by pages.',
      from: { pathNot: '^src/(pages/|app\\.tsx|test/)' },
      to: { path: '^src/pages/' },
    },
    {
      name: 'logic-without-ui',
      severity: 'error',
      comment: 'API calls and the session work without any components.',
      from: { path: '^src/(api|session)/' },
      to: { path: '^src/(components|pages)/' },
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
