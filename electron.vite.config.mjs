import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.js')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.js')
      }
    }
  },
  renderer: {
    plugins: [preact()],
    root: resolve(__dirname, 'src/renderer'),
    build: {
      cssMinify: true,
      sourcemap: false,
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  }
});
