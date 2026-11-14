import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// El monitor de Open Witness (`owit monitor`) sirve la API en 127.0.0.1:8790.
// En desarrollo, Vite reenvía /api (incluido el SSE de /api/events) a ese proceso.
const target = process.env.OWIT_MONITOR_URL ?? 'http://127.0.0.1:8790'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target, changeOrigin: true },
    },
  },
  build: {
    // la carpeta dist/ la sirve `owit monitor --ui dist`: sin CDN, funciona sin red
    assetsInlineLimit: 0,
  },
})
