// semantic-release config. It keeps the rules of the open-sauced shareable config this repository
// used to release with (ghcr.io/0-vortex/open-sauced-semantic-config-test:3.20.3), without the
// action.yml, Dockerfile and GITHUB_ENV steps it does not need.
// npm publishes through trusted publishing (OIDC): see .github/workflows/release.yml.
const noteKeywords = ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING']

module.exports = {
  branches: [
    'main',
    { name: 'beta', prerelease: true },
    { name: 'alpha', prerelease: true }
  ],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { type: 'build', release: 'minor' },
          { type: 'ci', release: 'patch' },
          { type: 'docs', release: 'minor' },
          { type: 'style', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'test', release: 'patch' },
          { type: 'revert', release: 'patch' },
          { type: 'chore', release: false }
        ],
        parserOpts: { noteKeywords }
      }
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        parserOpts: { noteKeywords },
        writerOpts: { commitsSort: ['subject', 'scope'] },
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'feature', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'perf', section: 'Performance Improvements' },
            { type: 'revert', section: 'Reverts' },
            { type: 'docs', section: 'Documentation' },
            { type: 'style', section: 'Styles' },
            { type: 'refactor', section: 'Code Refactoring' },
            { type: 'test', section: 'Tests' },
            { type: 'build', section: 'Build System' },
            { type: 'ci', section: 'Continuous Integration' }
          ]
        }
      }
    ],
    '@semantic-release/changelog',
    ['@semantic-release/npm', { tarballDir: 'pack' }],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'package-lock.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
      }
    ],
    [
      '@semantic-release/github',
      {
        addReleases: 'bottom',
        assets: [{ path: 'pack/*.tgz', label: 'Static distribution' }]
      }
    ]
  ]
}
