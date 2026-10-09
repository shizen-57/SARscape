import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({plugins:[react()],optimizeDeps:{exclude:['maplibre-gl']},server:{strictPort:true,proxy:{'/api':'http://127.0.0.1:8787'}},build:{chunkSizeWarningLimit:2000,rollupOptions:{output:{manualChunks:{'map-engine':['maplibre-gl'],'ui-vendor':['@radix-ui/react-dialog','@radix-ui/react-tooltip','@radix-ui/react-switch']}}}}})
