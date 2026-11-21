// Layering rules (handbook/01). Run: npm run arch:check
// Single package: src/ is flat (no layers yet, see CLAUDE.md exceptions), so only no-circular bites today.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'domain imports nothing from other layers',
      severity: 'error',
      from: { path: '/src/domain/' },
      to: { path: '/src/(application|infrastructure|presentation)/' },
    },
    {
      name: 'application-no-adapters',
      comment: 'application depends on ports, not on infrastructure or presentation',
      severity: 'error',
      from: { path: '/src/application/' },
      to: { path: '/src/(infrastructure|presentation)/' },
    },
    {
      name: 'presentation-no-infrastructure',
      comment: 'presentation gets adapters through container.ts, never imports them',
      severity: 'error',
      from: { path: '/src/presentation/' },
      to: { path: '/src/infrastructure/' },
    },
    {
      name: 'packages-not-apps',
      comment: 'shared packages never import from apps',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|dist|coverage|tests|e2e)' },
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
