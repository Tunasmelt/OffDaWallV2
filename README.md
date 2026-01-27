# OffDaWall - Hip-Hop Artist Discovery Platform

Discover top and upcoming artists across every hip-hop subgenre. From trap to boom bap, drill to cloud rap.

## Features

### Phase 1-2: Foundation & Discovery
- **Design System**: Street aesthetic with grayscale palette and red accents
- **Genre Taxonomy**: 10 hip-hop subgenres with curated artist lists
- **Home Page**: Collage-style genre grid with navigation

### Phase 3: Genre Pages
- **Dynamic Genre Pages**: Top and upcoming artists per genre
- **Popularity Scoring**: Algorithm-based artist classification
- **Artist Cards**: Grayscale images with red accent highlights

### Phase 4: Artist Profiles
- **Comprehensive Profiles**: Bio, stats, influence networks
- **Career Timeline**: Visual representation of artist journey
- **Related Artists**: Discover similar and influential artists

### Phase 5: Music Catalog
- **Complete Discography**: Albums, EPs, singles from MusicBrainz
- **Audio Player**: 30-second previews from Deezer
- **Album Browsing**: Expandable track listings with filters

### Phase 6: AI Recommendations
- **5 Category System**: Popular, Trending, Gems, Unique, Unpopular
- **Content-Based Filtering**: Intelligent track scoring
- **Recommendation Reasons**: Tooltips explaining selections

### Phase 7: Search & Navigation
- **Global Search**: Real-time artist search with autocomplete
- **Keyboard Shortcuts**: Cmd+K for quick search
- **Breadcrumbs**: Clear navigation paths
- **Mobile Menu**: Full genre navigation on mobile

### Phase 8: Performance & Polish
- **Error Boundaries**: Graceful error handling
- **Custom 404**: Genre suggestions when lost
- **Prefetch Links**: Hover to preload artist data
- **SEO Optimization**: Metadata, Open Graph, Twitter Cards

### Phase 9: Deployment Ready
- **API Monitoring**: Performance tracking and alerts
- **Error Logging**: Centralized logging with severity levels
- **Retry Logic**: Exponential backoff for failed requests
- **Production Config**: Optimized Next.js and Vercel settings

### Phase 10: Launch & Analytics
- **Analytics Tracking**: Genre popularity and user behavior
- **Feedback Widget**: In-app user feedback collection
- **Monitoring Dashboard**: API health and performance metrics

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **APIs**: 
  - MusicBrainz (artist metadata, discography)
  - AudioDB (images, biographies)
  - Deezer (track previews, popularity)
- **TypeScript**: Full type safety
- **Caching**: In-memory with TTL-based expiration

## API Architecture

### Data Flow
```
User Request → Next.js API Routes → Aggregation Service
                                          ↓
                    MusicBrainz + AudioDB + Deezer
                                          ↓
                            Response Cache (24hr)
                                          ↓
                              JSON Response → UI
```

### Rate Limits
- **MusicBrainz**: 1 request/second
- **AudioDB**: 100 requests/day (free tier)
- **Deezer**: 10 requests/minute (safety limit)

## Environment Variables

All APIs work without configuration. Optional upgrades:

```bash
# Optional: Upgrade AudioDB for higher limits
AUDIODB_API_KEY=your_key_here

# Optional: Base URL for production
NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# Optional: Enable analytics
NEXT_PUBLIC_ANALYTICS_ENABLED=true
```

See `.env.example` for full template.

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd offdawall
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Open browser**
   ```
   http://localhost:3000
   ```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy to Vercel

```bash
vercel deploy
```

## API Endpoints

- `GET /api/genres` - List all genres
- `GET /api/genres/[slug]` - Artists in genre
- `GET /api/artists/[mbid]` - Artist profile
- `GET /api/artists/[mbid]/catalog` - Artist discography
- `GET /api/artists/[mbid]/recommendations` - AI recommendations
- `GET /api/search?q={query}` - Search artists
- `GET /api/health` - System health check
- `GET /api/admin/monitoring` - Monitoring dashboard

## Project Structure

```
/app                    # Next.js app directory
  /api                 # API routes
  /genres/[slug]       # Genre pages
  /artists/[mbid]      # Artist pages
  /search              # Search results
/components            # React components
/lib                   # Utilities and services
  /services            # API service layers
/public                # Static assets
```

## Performance

- **Caching**: 24hr TTL for artist data, 7 days for images
- **Image Optimization**: WebP format with Next.js Image
- **Prefetching**: Artist data loaded on hover
- **Code Splitting**: Automatic with Next.js
- **Compression**: Enabled via Vercel

## Accessibility

- **ARIA Labels**: Full screen reader support
- **Keyboard Navigation**: All interactive elements
- **Focus Management**: Visible focus indicators
- **Semantic HTML**: Proper heading hierarchy

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

All rights reserved.

## Credits

- **MusicBrainz**: Open music metadata
- **AudioDB**: Artist images and biographies
- **Deezer**: Track previews and data
- **Design**: Street aesthetic inspired by hip-hop culture
