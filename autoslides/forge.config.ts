import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import path from 'path';
import { readdir, rm } from 'fs/promises';

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
    icon: 'resources/img/icon', // Will use .icns on macOS, .ico on Windows
    // Include all necessary resources
    extraResource: [
      // Always include terms.rtf
      'resources/terms',
      // Bundled YOLO model(s) for auto-crop. Kept outside asar so we can
      // read the bytes off disk via process.resourcesPath at runtime.
      'resources/models',
      // Include FFmpeg binary for all platforms
      'node_modules/ffmpeg-static',
      // Include ffprobe binary (ffprobe-static; NOT part of ffmpeg-static).
      // Required by the lecture-compress probe step in packaged builds.
      'node_modules/ffprobe-static',
      // Include sharp and its dependencies
      'node_modules/sharp',
      'node_modules/@img',
      'node_modules/detect-libc',
      'node_modules/semver'
    ]
  },
  rebuildConfig: {},
  hooks: {
    // ffprobe-static ships binaries for every platform/arch in bin/<platform>/<arch>.
    // We bundle the whole package via extraResource, then prune everything except
    // the build target here so the packaged app only carries the one ffprobe it
    // can actually run. Runs after extraResource is copied (unlike packageAfterCopy),
    // and uses the resolved build platform/arch so cross-builds prune correctly.
    postPackage: async (_forgeConfig, options) => {
      const { platform, arch, outputPaths } = options;
      for (const outputPath of outputPaths) {
        const resourcesDir = platform === 'darwin'
          ? path.join(outputPath, 'AutoSlides.app', 'Contents', 'Resources')
          : path.join(outputPath, 'resources');
        const binDir = path.join(resourcesDir, 'ffprobe-static', 'bin');

        let platformDirs: string[];
        try {
          platformDirs = await readdir(binDir);
        } catch {
          // ffprobe-static not present in this output (nothing to prune)
          continue;
        }

        for (const platformName of platformDirs) {
          const platformPath = path.join(binDir, platformName);
          if (platformName !== platform) {
            await rm(platformPath, { recursive: true, force: true });
            continue;
          }
          // Within the target platform, keep only the target arch.
          const archDirs = await readdir(platformPath);
          for (const archName of archDirs) {
            if (archName !== arch) {
              await rm(path.join(platformPath, archName), { recursive: true, force: true });
            }
          }
        }
        console.log(`[forge] Pruned ffprobe-static to ${platform}/${arch}`);
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
