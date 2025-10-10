import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

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
    // macOS DMG
    new MakerDMG({
      name: 'AutoSlides',
      icon: 'resources/img/icon.icns',
      format: 'ULFO',
      background: './build/background.png',
      contents: [
        { x: 405, y: 210, type: 'link', path: '/Applications' },
        { x: 135, y: 210, type: 'file', path: './out/AutoSlides-darwin-arm64/AutoSlides.app' }
      ]
    }),
    // Windows Squirrel
    new MakerSquirrel({
      name: 'AutoSlides',
      setupIcon: 'resources/img/icon.ico',
      setupExe: 'AutoSlides-Setup.exe'
    })
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
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
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
