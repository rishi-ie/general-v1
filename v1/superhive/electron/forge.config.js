import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'SuperHive',
    executableName: 'superhive',
    asar: true,
  },
  makers: [
    new MakerSquirrel({
      name: 'superhive',
    }),
    new MakerZIP({}, ['darwin', 'linux']),
    new MakerDeb({
      options: {
        name: 'superhive',
        productName: 'SuperHive',
      },
    }),
    new MakerDMG({
      name: 'SuperHive',
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'main/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'preload/preload.ts',
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
  ],
};

export default config;
