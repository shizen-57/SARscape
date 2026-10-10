# Open-source reuse decisions

The application uses established rendering, UI and geospatial modules. Product-specific controls, caching, processing adapters and provenance are authored here. Synthetic generators are isolated legacy test fixtures and are absent from shipping routes.

| Project | Role | Decision |
| --- | --- | --- |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | WebGL map rendering, terrain, camera, GeoJSON layers | Integrated via npm. BSD-3-Clause. Uses raster DEM terrain instead of modeling Earth ourselves. |
| [Radix Primitives](https://github.com/radix-ui/primitives) | Accessible dialogs, switches, tooltips | Integrated via npm. MIT. |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | UI component conventions | Local shadcn-style Button and Sheet wrappers using Radix, cva, clsx, and tailwind-merge. Not a full shadcn CLI-generated template. |
| [Lucide](https://github.com/lucide-icons/lucide) | Consistent icons | Integrated via npm. ISC. |
| [React](https://github.com/facebook/react) and [Vite](https://github.com/vitejs/vite) | App state and development/build tooling | Integrated via npm. MIT. |
| [ASF NISAR Cookbook](https://github.com/ASFOpenSARlab/NISAR_Cookbook) | Recipes for real NISAR data workflows | Reviewed and linked as the next processing stage. Apache-2.0. Not imported or falsely represented as a running processor. |
| [asf_search](https://github.com/ASFHyP3/asf_search) | ASF discovery and authenticated download | Reference for scientific processing. The Hono backend calls the public ASF Search API and caches normalized metadata. |
| [Hono](https://github.com/honojs/hono) | Backend API on Node and Workers | Integrated via npm. MIT. Local Python workers process imagery and authentic scientific files. |
| [TanStack Query](https://github.com/TanStack/query) | Browser data cache | Integrated via npm. MIT. Date frames are reused locally after backend preparation. |
| [SQLite](https://sqlite.org/) | Persistent local backend cache | Uses built-in SQLite when available, otherwise better-sqlite3; prepared statements, WAL and a tracked migration. |
| [CesiumJS](https://github.com/CesiumGS/cesium) | Global 3D globe / 3D Tiles | Evaluated. Apache-2.0. MapLibre better fits the current regional glacier workspace; revisit Cesium for global globe and large 3D Tiles use cases. |
| [kepler.gl](https://github.com/keplergl/kepler.gl) | Geospatial exploration interface | UX reference for layer controls and timeline; not embedded as an additional renderer. |

## Data services
Esri World Imagery supplies the satellite basemap, OpenStreetMap supplies the street basemap, and Mapterhorn supplies elevation. All visible attribution stays on the map. These are independent services, not NISAR science layers. No remote image is downloaded merely to work around chat rendering restrictions.

The approximate Aletsch demonstration centerline was checked against [OpenStreetMap glacier way 42742456](https://www.openstreetmap.org/way/42742456), retrieved through the public Nominatim API. This does not turn the synthetic layer into a scientific glacier inventory.

## Science integration boundary
The browser displays authentic basemaps, dated captures, measured indices and radar samples. HDF5 inspection and GOFF/GCOV processing run in the local Python backend; the browser uploads files, selects inspected channels and downloads derived products. Independent velocity, flooding and forest-loss interpretation remains outside software-schema verification. See FEATURE_AUDIT.md.
