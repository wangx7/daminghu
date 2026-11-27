import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'vendor-three';
          if (id.includes('node_modules/peerjs')) return 'vendor-peerjs';
          if (id.includes('node_modules/qrcode')) return 'vendor-qrcode';
          if (id.includes('node_modules/vue') || id.includes('node_modules/pinia')) return 'vendor-vue';
          if (id.includes('legacy/osm_data')) return 'data-osm';
          if (id.includes('legacy/landmarks') || id.includes('legacy/walls')) return 'world-landmarks';
        },
      },
    },
  },
});
