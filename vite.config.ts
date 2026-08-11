import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const productionBase = '/80kg-sprint/'

export default defineConfig(({ command }) => {
  const base = command === 'serve' ? '/' : productionBase

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        // Updates are deliberately user-confirmed. The app creates a backup
        // acknowledgement and an integrity snapshot before activating a new SW.
        registerType: 'prompt',
        injectRegister: null,
        manifest: {
          id: base,
          name: '減脂追蹤',
          short_name: '減脂追蹤',
          description: '每日體重、飲食、活動與減脂趨勢追蹤；核心資料保留在你的裝置。',
          lang: 'zh-TW',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait-primary',
          theme_color: '#0a0d0c',
          background_color: '#0a0d0c',
          icons: [
            { src: `${base}app-icon-v2-192x192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `${base}app-icon-v2-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: `${base}app-icon-v2-maskable-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          cacheId: '80kg-sprint',
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,webmanifest}']
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    test: {
      environment: 'node',
      // The Worker has its own package, dependencies and Vitest config. Keeping
      // the root suite scoped to src prevents CI from loading Worker tests before
      // `npm ci --prefix api-worker` installs runtime dependencies such as Zod.
      include: ['src/**/*.test.{ts,tsx}']
    }
  }
})
