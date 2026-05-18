import { defineConfig } from 'vite'
import { rogue, rogueRouter } from '@jjordy/rogue/vite'

export default defineConfig({
  plugins: [rogue(), rogueRouter()],
  esbuild: { jsx: 'preserve' },
})
