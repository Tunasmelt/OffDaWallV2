# Image Sources

This document lists the allowed image hosts and the upstream service that supplies them. Use it to update `next.config.mjs` when new image domains appear.

## Artist Images

- AudioDB
  - `www.theaudiodb.com`
  - `r2.theaudiodb.com`
- Last.fm
  - `lastfm.freetls.fastly.net`
  - `lastfm-img2.akamaized.net`
- Deezer
  - `cdn-images.dzcdn.net`
  - `cdns-images.dzcdn.net`
  - `e-cdns-images.dzcdn.net`

## Album / Cover Art

- Cover Art Archive
  - `coverartarchive.org`
- Last.fm (fallback cover art)
  - `lastfm.freetls.fastly.net`
  - `lastfm-img2.akamaized.net`
- Deezer (track/album art from previews)
  - `cdn-images.dzcdn.net`
  - `cdns-images.dzcdn.net`
  - `e-cdns-images.dzcdn.net`

## App-owned Assets

- Vercel Blob (project assets)
  - `hebbkx1anhila5yf.public.blob.vercel-storage.com`
- Local assets
  - `/placeholder.svg`
  - `/placeholder-user.jpg`
  - `/logo.png`, `/logo-transparent.png`, `/icon*.png`

## Notes

- If an image fails to render in the UI, check its host against this list.
- When a new host appears, add it to `next.config.mjs` and update this file.
