import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

// Demo mode is a deletable add-on: all demo data/behavior lives in
// src/renderer/demo/, and production code must never statically import it (the
// dependency points inward — demo → shared/production). The single guarded
// dynamic import() in the renderer entry points is not a static import and is
// not flagged. Appended to every renderer boundary rule below.
const DEMO_IMPORT_BAN = {
  group: ['@renderer/demo', '@renderer/demo/*'],
  message: 'Production code must not import src/renderer/demo/. Demo wires itself via the override registry (@shared/overrideRegistry); deleting demo/ must leave the app working.',
};

// Domain-boundary helper: a feature domain may not import from sibling feature
// domains. Returns a no-restricted-imports rule that forbids every domain other
// than `self` and explicitly-allowed cross-domain edges (plus the demo ban).
const FEATURE_DOMAINS = ['video', 'results', 'offline', 'download', 'ai', 'export', 'course', 'settings', 'platform', 'webCapture', 'tools'];
function featureBoundaryRule(self, allowed = []) {
  const allow = new Set([self, ...allowed]);
  const forbidden = FEATURE_DOMAINS.filter(d => !allow.has(d));
  return {
    'no-restricted-imports': ['error', {
      patterns: [
        ...forbidden.map(d => ({
          group: [`@features/${d}/*`, `@features/${d}`],
          message: `Feature domain '${self}' may not import from sibling domain '${d}'. Move shared code into @shared/* or whitelist the edge in eslint.config.mjs.`,
        })),
        DEMO_IMPORT_BAN,
      ],
    }],
  };
}

// Main process domain rule. Every domain may import @main/infra/* and
// @main/platform/* freely. Sibling domains are forbidden by default.
const MAIN_DOMAINS = ['video', 'extraction', 'ai', 'export', 'download'];
function mainDomainRule(self, allowed = []) {
  const allow = new Set([self, 'infra', 'platform', ...allowed]);
  const forbidden = [...MAIN_DOMAINS, 'platform', 'infra'].filter(d => !allow.has(d));
  return {
    'no-restricted-imports': ['error', {
      patterns: forbidden.map(d => ({
        group: [`@main/${d}/*`],
        message: `Main domain '${self}' may not import from sibling domain '${d}'.`,
      })),
    }],
  };
}

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        HTMLElement: 'readonly',
        HTMLVideoElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLImageElement: 'readonly',
        Image: 'readonly',
        Worker: 'readonly',
        MessageChannel: 'readonly',
        structuredClone: 'readonly',
        crypto: 'readonly',
        performance: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        indexedDB: 'readonly',
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      // Match previous ESLint 8 behavior - these were not errors before
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      // Route all logging through createLogger (@shared/utils/logger or
      // @main/infra/logger), which gates debug/info to dev and tags namespaces.
      // The two logger modules and the always-on AI debug wrappers are exempted
      // below.
      'no-console': 'error',
    },
  },

  // Logging exemptions: the logger modules ARE the console boundary, and the AI
  // services keep intentional always-on DEBUG wrappers (prod has no other AI
  // diagnostics — see CLAUDE.md / memory project_debug_flags_intentional).
  {
    files: [
      'src/renderer/shared/utils/logger.ts',
      'src/main/infra/logger.ts',
      'src/main/ai/llmApiService.ts',
      'src/main/ai/aiFilteringService.ts',
      // Build/tooling scripts — console output is their intended UX.
      'scripts/**',
      'forge.config.ts',
      '*.config.{ts,mjs}',
    ],
    rules: { 'no-console': 'off' },
  },

  // ----------------------------------------------------------------------
  // Renderer feature-domain boundaries: a domain may not import from a
  // sibling domain unless the edge is whitelisted below.
  //
  // Whitelisted edges (current usage):
  //   video → course      (Course type in useSlideExtraction)
  //   download → video    (PlaybackData type in useTaskQueue)
  //   download → ai       (classifier callbacks injected into post-processing
  //                        pipeline ctx — shared/ cannot import from features/)
  //   offline → ai        (same; offline post-processing path)
  //   settings → platform, ai (SettingsContext bundles useAuth/useCache/useAI*
  //                            composables for the LeftPanel tab children)
  //   (results → offline edge removed once Phase 10 extracted shared/autoCrop)
  // ----------------------------------------------------------------------
  { files: ['src/renderer/features/video/**/*.{ts,vue}'],     rules: featureBoundaryRule('video',     ['course']) },
  { files: ['src/renderer/features/results/**/*.{ts,vue}'],   rules: featureBoundaryRule('results') },
  { files: ['src/renderer/features/offline/**/*.{ts,vue}'],   rules: featureBoundaryRule('offline',   ['ai']) },
  { files: ['src/renderer/features/download/**/*.{ts,vue}'],  rules: featureBoundaryRule('download',  ['video', 'course', 'ai']) },
  { files: ['src/renderer/features/ai/**/*.{ts,vue}'],        rules: featureBoundaryRule('ai') },
  { files: ['src/renderer/features/export/**/*.{ts,vue}'],    rules: featureBoundaryRule('export') },
  { files: ['src/renderer/features/course/**/*.{ts,vue}'],    rules: featureBoundaryRule('course') },
  { files: ['src/renderer/features/settings/**/*.{ts,vue}'],  rules: featureBoundaryRule('settings',  ['platform', 'ai']) },
  { files: ['src/renderer/features/platform/**/*.{ts,vue}'],  rules: featureBoundaryRule('platform') },
  { files: ['src/renderer/features/webCapture/**/*.{ts,vue}'],rules: featureBoundaryRule('webCapture') },
  { files: ['src/renderer/features/tools/**/*.{ts,vue}'],     rules: featureBoundaryRule('tools') },

  // shared/ is foundational — it must not depend on features/ (one-way layering)
  // and must never import the deletable demo/ folder.
  {
    files: ['src/renderer/shared/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@features/*', '@features'], message: 'shared/ is foundational; do not import from features/.' },
          DEMO_IMPORT_BAN,
        ],
      }],
    },
  },

  // Main process domain boundaries. Sibling domains are forbidden;
  // infra/ and platform/ are always allowed.
  { files: ['src/main/video/**/*.ts'],      rules: mainDomainRule('video') },
  { files: ['src/main/extraction/**/*.ts'], rules: mainDomainRule('extraction') },
  { files: ['src/main/ai/**/*.ts'],         rules: mainDomainRule('ai') },
  { files: ['src/main/export/**/*.ts'],     rules: mainDomainRule('export') },
  { files: ['src/main/download/**/*.ts'],   rules: mainDomainRule('download') },
  {
    files: ['src/main/infra/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['@main/video/*', '@main/extraction/*', '@main/ai/*', '@main/export/*', '@main/download/*', '@main/platform/*'],
                     message: 'infra/ is foundational; do not import from other main domains.' }],
      }],
    },
  },

  {
    ignores: ['node_modules/**', '.vite/**', 'out/**', 'dist/**'],
  }
);
