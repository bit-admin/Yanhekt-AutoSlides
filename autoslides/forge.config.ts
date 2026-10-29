import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// One sentence for every macOS privacy-protected location the output folder can
// live in (the default is ~/Downloads/AutoSlides). Tahoe's TCC refuses access
// without a prompt when the bundle cannot say why it wants the folder.
const FOLDER_USAGE =
  'AutoSlides saves and reads lecture videos and extracted slides in the output folder you choose.';

// Check if we're running in development mode (npm start)
const isDev = process.argv.some(arg => arg.includes('electron-forge-start'));

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      // ort-wasm/** is unpacked so onnxruntime-web's runtime dynamic import of
      // the .mjs backend loader works from file:// (ESM imports out of asar
      // fail in Electron — the file needs to live on the real filesystem).
      unpack: '**/{*.node,sharp/**/*,@img/**/*,ort-wasm/**/*}'
    },
    name: 'AutoSlides',
    executableName: process.platform === 'linux' ? 'autoslides' : 'AutoSlides',
    appBundleId: 'com.bitadmin.autoslides',
    appCategoryType: 'public.app-category.education',
    // `autoslides://course/<id>` and `autoslides://session/<id>` (@common/deepLink):
    // CFBundleURLTypes in Info.plist, before the postPackage re-sign. Windows and
    // Linux register the same scheme in electron-builder.yml.
    protocols: [{ name: 'AutoSlides Link', schemes: ['autoslides'] }],
    extendInfo: {
      NSDownloadsFolderUsageDescription: FOLDER_USAGE,
      NSDocumentsFolderUsageDescription: FOLDER_USAGE,
      NSDesktopFolderUsageDescription: FOLDER_USAGE,
      NSRemovableVolumesUsageDescription: FOLDER_USAGE,
      NSNetworkVolumesUsageDescription: FOLDER_USAGE,
    },
    icon: 'resources/img/icon', // Will use .icns on macOS, .ico on Windows
    // Leave ignore to Vite's .vite-only filter: vendor media tools and the
    // download cache must not also enter app.asar (extraResource copies once).
    // Include all necessary resources
    extraResource: [
      // Bundled YOLO model(s) for auto-crop. Kept outside asar so we can
      // read the bytes off disk via process.resourcesPath at runtime.
      // Terms open in the browser (https://learn.ruc.edu.kg/terms) — no bundled RTF.
      'resources/models',
      // Tray icons for Keep Running in the Tray (platform/trayService.ts).
      'resources/tray',
      // Earlier terms of the course index, sealed and signed
      // (platform/courseIndex/). Git-ignored; `npm run index-bundle` fills it,
      // release.yml and make:mac run that first. Left out when absent (CI).
      ...(fs.existsSync(path.join(__dirname, 'vendor/course-index')) ? ['vendor/course-index'] : []),
      // The agent skill for the command line (repo `skills/`). The app copies
      // it under userData on launch for agents to link (cliInstall/skillBundle.ts).
      '../skills',
      // generateAssets adds the pinned FFmpeg/FFprobe bundle for the explicit
      // target. Do not pick a binary from the build host's node_modules.
      // Include sharp and its dependencies
      'node_modules/sharp',
      'node_modules/@img',
      'node_modules/detect-libc',
      'node_modules/semver'
    ]
  },
  rebuildConfig: {},
  hooks: {
    generateAssets: async (forgeConfig, platform, arch) => {
      execFileSync(process.execPath, [
        path.join(__dirname, 'scripts/media-tools.mjs'), 'prepare',
        '--platform', platform, '--arch', arch,
      ], { stdio: 'inherit' });
      const mediaRoot = path.join(__dirname, 'vendor/media-tools');
      const resources = forgeConfig.packagerConfig.extraResource ?? [];
      const existing = typeof resources === 'string' ? [resources] : resources;
      forgeConfig.packagerConfig.extraResource = [
        ...existing.filter(resource => !resource.startsWith(mediaRoot + path.sep)),
        path.join(mediaRoot, `${platform}-${arch}`, 'media-tools'),
      ];
    },
    // Packager rewrites Info.plist after Electron's own ad-hoc signature and the
    // fuses plugin re-signs only the executable, which ships a bundle whose
    // signature is invalid ("Info.plist=not bound", identifier
    // com.github.Electron). macOS privacy protection then cannot attribute a
    // Downloads prompt or grant to the app and denies with EPERM. Re-sign the
    // whole bundle ad-hoc and refuse to ship one that fails strict verification.
    //
    // No hardened runtime: ad-hoc signing plus library validation would reject
    // the unpacked native modules. An ad-hoc identity still changes every
    // release, so macOS may ask for folder access again after an update — only
    // a Developer ID certificate avoids that.
    postPackage: async (_forgeConfig, { platform, arch, outputPaths }) => {
      for (const outputPath of outputPaths) {
        const appPath = path.join(outputPath, 'AutoSlides.app');
        const resources = platform === 'darwin'
          ? path.join(appPath, 'Contents/Resources')
          : path.join(outputPath, 'resources');
        execFileSync(process.execPath, [
          path.join(__dirname, 'scripts/media-tools.mjs'), 'verify',
          '--platform', platform, '--arch', arch,
          '--directory', path.join(resources, 'media-tools'),
        ], { stdio: 'inherit' });
        if (platform === 'darwin') {
          execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
          execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { stdio: 'inherit' });
        }
      }
    },
  },
  makers: [
    // macOS: Use `npm run package` then DropDMG manually
    // Windows: Use `npm run make:win` (electron-builder with NSIS, see electron-builder.yml)
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/webviewCapturePreload.ts',
          config: 'vite.webviewPreload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/webviewSsoPreload.ts',
          config: 'vite.webviewPreload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
        {
          name: 'tools_window',
          config: 'vite.tools.config.ts',
        },
      ],
    }),
    // Auto-unpack native modules from asar (packaging only — during dev
    // the modules are loaded directly from node_modules, and this plugin
    // also overrides the start command which conflicts with VitePlugin)
    ...(!isDev ? [new AutoUnpackNativesPlugin({})] : []),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    // Only include during packaging to avoid plugin conflict with VitePlugin during dev
    ...(!isDev ? [new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    })] : []),
  ],
};

export default config;
