import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Link to the parent peach-math-field package
      'peach-math-field': path.resolve(__dirname, '../../src/index.ts'),
      'peach-math-field/styles/math-field.css': path.resolve(__dirname, '../../src/styles/math-field.css'),
    },
  },
})
