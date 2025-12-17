import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

// Check if we're running in development mode (npm start)
const isDev = process.argv.some(arg => arg.includes('electron-forge-start'));

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'AutoSlides',
    executableName: 'AutoSlides',
    appBundleId: 'com.bitadmin.autoslides',
    appCategoryType: 'public.app-category.education',
    icon: 'resources/img/icon', // Will use .icns on macOS, .ico on Windows
    // Include all necessary resources
    extraResource: [
      // Always include terms.rtf
      'resources/terms',
      // Include FFmpeg binary for all platforms
      'node_modules/ffmpeg-static'
    ]
  },
  rebuildConfig: {},
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
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
        {
          name: 'trash_window',
          config: 'vite.trash.config.ts',
        },
      ],
    }),
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
