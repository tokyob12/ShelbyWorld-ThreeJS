import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.wasm'], 
  
  // ===================================================================
  // PREVENT BUNDLE CACHING OF WEB3 DEPENDENCIES
  // Excludes Shelby and clay-codes from Vite's pre-bundling so WebAssembly
  // assets can resolve directly from their standard paths.
  // ===================================================================
  optimizeDeps: {
    exclude: ['@shelby-protocol/clay-codes', '@shelby-protocol/sdk'],
  },
  // ===================================================================

  server: {
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    }
  }
})