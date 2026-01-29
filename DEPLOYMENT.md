# OffDaWall - Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables
- [ ] Set `NEXT_PUBLIC_BASE_URL` to production domain
- [ ] Configure `AUDIODB_API_KEY` if using paid tier
- [ ] Review and set any optional feature flags

### 2. API Configuration
- [ ] Verify MusicBrainz API compliance (User-Agent header set)
- [ ] Confirm AudioDB rate limits (100 req/day on free tier)
- [ ] Test Deezer API fallback chain
- [ ] Validate cache TTL settings (24hr artist, 7 day images)

### 3. Performance Optimization
- [ ] Run `npm run build` and check for errors
- [ ] Verify bundle size is acceptable
- [ ] Test loading performance with Lighthouse
- [ ] Confirm image optimization is working
- [ ] Validate all routes are rendering correctly

### 4. Testing
- [ ] Test all 10 genre pages load correctly
- [ ] Verify artist profile pages work with real MBIDs
- [ ] Confirm search functionality works
- [ ] Test mobile responsive design
- [ ] Verify breadcrumb navigation
- [ ] Test audio player with Deezer previews
- [ ] Validate recommendation engine output

### 5. Error Handling
- [ ] Custom 404 page displays correctly
- [ ] Error boundaries catch and display errors
- [ ] API fallback chain works (MusicBrainz → AudioDB → cache)
- [ ] Rate limit handling works correctly
- [ ] Empty states display properly

### 6. SEO & Metadata
- [ ] All pages have proper meta titles and descriptions
- [ ] Open Graph tags are set correctly
- [ ] Twitter Card metadata is present
- [ ] Sitemap is generated (if implemented)
- [ ] Robots.txt is configured

## Deployment Steps

### Vercel Deployment (Recommended)

**Recommended workflow (least tedious):**
1. Connect the Git repo to Vercel once (Dashboard → New Project).
2. Set environment variables in Vercel (Preview + Production).
3. Push to `main` for automatic production deploys.
4. Use preview branches for testing (Vercel auto-creates preview deployments).
5. Roll back from the Vercel Dashboard if needed.

1. **Connect Repository**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login to Vercel
   vercel login
   
   # Deploy
   vercel
   ```

2. **Configure Environment Variables**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add `NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app`
   - Add any optional variables from `.env.example`

   Optional local sync:
   ```bash
   vercel env pull .env.local
   ```

3. **Deploy to Production**
   ```bash
   vercel --prod
   ```

4. **Set up Custom Domain** (Optional)
   - Go to Vercel Dashboard → Settings → Domains
   - Add your custom domain (e.g., offdawall.app)
   - Configure DNS settings as instructed

### Build Optimization

The following optimizations are already configured:

- **Image Optimization**: Next.js Image component with automatic WebP conversion
- **Code Splitting**: Automatic route-based code splitting
- **Tree Shaking**: Unused code removed during build
- **Minification**: CSS and JS minified
- **Caching**: API responses cached with SWR strategy
- **Prefetching**: Artist data prefetched on hover

## Post-Deployment

### 1. Monitoring

- [ ] Check `/api/admin/monitoring` endpoint for system health
- [ ] Monitor error logs in console
- [ ] Track API rate limit usage
- [ ] Review cache hit rates

### 2. Performance Validation

Run Lighthouse audit:
```bash
npm run build
npm start
# Open Chrome DevTools → Lighthouse → Generate Report
```

Target scores:
- Performance: >90
- Accessibility: >95
- Best Practices: >95
- SEO: >90

### 3. API Rate Limit Management

**MusicBrainz**: 1 request/second
- Cache TTL: 24 hours
- Estimated daily requests: ~500-1000
- Status: Well within limits

**AudioDB**: 100 requests/day (free tier)
- Cache TTL: 7 days for images
- Only fetches for first 10 artists per genre
- Status: Monitor usage, upgrade if needed

**Deezer**: No official limit, self-limited to 10/min
- Cache TTL: 24 hours
- Status: Should be fine with caching

### 4. Troubleshooting

**Issue: Artists not loading**
- Check MusicBrainz API status
- Verify User-Agent header is set
- Check rate limiter isn't blocking requests

**Issue: Images not appearing**
- Verify AudioDB API is responding
- Check image URLs are valid
- Confirm fallback placeholder works

**Issue: Search not working**
- Check MusicBrainz search query format
- Verify cache is working
- Test with simple artist names

**Issue: Audio previews not playing**
- Confirm Deezer API is accessible
- Check CORS configuration
- Verify audio URLs are valid

## Maintenance

### Regular Tasks

- **Weekly**: Check `/api/admin/monitoring` for errors
- **Monthly**: Review API usage and cache efficiency
- **Quarterly**: Update dependencies and run security audit

### Scaling Considerations

If you outgrow free tier limits:

1. **AudioDB**: Upgrade to paid tier for higher image limits
2. **Caching**: Implement Redis/Upstash for distributed caching
3. **CDN**: Use Vercel Edge Network or external CDN for images
4. **Database**: Add persistent storage for artist data

## Support

For issues or questions:
- Check logs in Vercel Dashboard
- Review `/api/admin/monitoring` endpoint
- Consult API documentation (MusicBrainz, AudioDB, Deezer)

---

**OffDaWall** - Discover Hip-Hop Artists Off The Wall
