import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'ws', 'path', 'fs', 'os', 'child_process', 'crypto'],
    },
  },
});
