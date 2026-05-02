import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { mochiPlugin } from '@mochi/web/vite'
import { lingui } from '@lingui/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  base: '/repositories/',
  plugins: [
    mochiPlugin(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // jiti is a Node-only build tool pulled in via @lingui/conf's peer-dep
      // chain. Vite tree-shakes it out on Node 22+, but on Node 20.18 (sansho)
      // it leaks into the browser bundle and fails because jiti.mjs imports
      // createRequire from "node:module", which Vite's __vite-browser-external
      // shim does not provide on sub-20.19 Nodes. Aliasing to an empty stub
      // keeps the build green regardless of Node version.
      { find: /^jiti(\/.*)?$/, replacement: path.resolve(__dirname, './empty.mjs') },
    ],
  },
})
