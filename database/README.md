# Database

This folder holds project data and SQLite storage, following the user's corrected folder name.

- `sarscape.sqlite`: persistent public ASF metadata, prepared Sentinel-2 PNG tiles, and official Swiss aerial JPEG tiles, ignored by Git. Concurrent requests share work. Sentinel tiles expire after 30 days; Swiss mosaics after one day because providers can revise them.
- `migrations/`: the schema used by the local backend cache.
- `raw/`: downloaded NISAR science products, ignored by Git. None are downloaded automatically.
- `processed/`: prepared image crops, PNG tiles, and science-processing results, ignored by Git. This stores reusable image data; the browser combines it with separately supplied terrain heights to render an interactive 3D view.
- `manifests/`: tracked provenance records, processing configuration, units, and validation reports.

Never store Earthdata credentials or tokens in this folder. Display demo and scientific layers as separate products with explicit provenance.
