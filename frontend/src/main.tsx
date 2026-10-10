import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {setWorkerUrl} from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import './observations.css'
const queryClient=new QueryClient()
setWorkerUrl(mapWorkerUrl)
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></React.StrictMode>)
