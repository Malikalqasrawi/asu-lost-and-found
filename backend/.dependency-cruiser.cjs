/** Which parts of the backend may import which. Run with `npm run lint:layers`. */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Files that import each other in a loop are hard to change and to test.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'controllers-use-services',
      severity: 'error',
      comment: 'A controller handles HTTP and calls a service; database and file access stay in services.',
      from: { path: '\\.controller\\.ts$' },
      to: { path: '^src/(prisma|storage)/' },
    },
    {
      name: 'controllers-only-in-modules',
      severity: 'error',
      comment: 'Only a feature module wires up its controller.',
      from: { pathNot: '\\.module\\.ts$' },
      to: { path: '\\.controller\\.ts$' },
    },
    {
      name: 'dto-stay-in-feature',
      severity: 'error',
      comment: 'Request shapes belong to their own feature; other features call its service.',
      from: { path: '^src/([^/]+)/' },
      to: { path: '^src/[^/]+/dto/', pathNot: '^src/$1/dto/' },
    },
    {
      name: 'common-stays-common',
      severity: 'error',
      comment: 'Shared helpers must not depend on any feature.',
      from: { path: '^src/common/' },
      to: { path: '^src/', pathNot: '^src/common/' },
    },
    {
      name: 'no-tests-in-app',
      severity: 'error',
      comment: 'Application code never imports test files or test helpers.',
      from: { path: '^src/', pathNot: '\\.spec\\.ts$' },
      to: { path: '(\\.spec\\.ts$|^test/)' },
    },
    {
      name: 'no-dev-packages-in-app',
      severity: 'error',
      comment: 'Development packages are not in the Docker image, so application code cannot use them.',
      from: { path: '^src/', pathNot: '\\.spec\\.ts$' },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/generated/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.js'] },
  },
};
