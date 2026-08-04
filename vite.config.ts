import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub repo name so asset URLs resolve on Pages:
// https://<user>.github.io/tres-meses/
export default defineConfig({
  base: '/tres-meses/',
  plugins: [react()],
})
