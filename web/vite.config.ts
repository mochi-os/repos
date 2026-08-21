// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

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
      // jiti is Node-only, pulled in via @lingui/conf. On Node < 20.19 Vite
      // leaks it into the browser bundle (createRequire from "node:module" is
      // missing from the shim), so alias it to an empty stub.
      { find: /^jiti(\/.*)?$/, replacement: path.resolve(__dirname, './empty.mjs') },
    ],
  },
})
