# SearXNG Instances Guide

## Important Note About Public Instances

Many public SearXNG instances implement anti-bot measures and may block programmatic JSON API access. This is normal security behavior to prevent abuse.

## Recommended Solutions

### Option 1: Self-Host SearXNG (Best)

The most reliable option is to self-host your own SearXNG instance:

**Using Docker:**
```bash
docker run -d \
  --name searxng \
  -p 8080:8080 \
  -v "${PWD}/searxng:/etc/searxng" \
  -e SEARXNG_BASE_URL=http://localhost:8080/ \
  searxng/searxng:latest
```

Then use: `http://localhost:8080` as your instance URL.

**Benefits:**
- No rate limiting
- Reliable access
- Full control
- Privacy

### Option 2: Use Working Public Instances

Some instances are more API-friendly. Test these:

```typescript
searxngConfig: {
  instances: [
    'http://localhost:8080',  // Your local instance (recommended)
    // Public instances (may have restrictions):
    'https://searx.fmac.xyz',
    'https://search.ononoki.org',
    'https://searx.tuxcloud.net'
  ],
  priorityOrder: false,  // Try random rotation
  maxRetries: 3,
  timeout: 15000  // 15 second timeout
}
```

### Option 3: Increase Resilience

Configure the library to handle failures gracefully:

```typescript
const agent = new ResearchAgent({
  openRouterKey: process.env.OPENROUTER_API_KEY!,
  searxngConfig: {
    instances: [
      'http://localhost:8080',  // Primary
      'https://instance1.com',  // Backup
      'https://instance2.com',  // Backup
      'https://instance3.com'   // Backup
    ],
    priorityOrder: true,  // Try localhost first, then failover
    maxRetries: 2,        // Retry each instance twice
    timeout: 15000
  }
});
```

## Testing Instances

Test an instance before using it:

```bash
curl -s -A "Mozilla/5.0" \
  "https://your-instance.com/search?q=test&format=json" \
  | jq '.results[0].title'
```

If you get valid JSON with search results, the instance works!

## Finding More Instances

1. Visit [searx.space](https://searx.space/) - Lists public instances with uptime stats
2. Filter by:
   - High uptime (>95%)
   - JSON format support
   - No rate limiting

## Common Issues

### 403 Forbidden
**Cause**: Instance blocks automated requests
**Solution**: Use self-hosted instance or find API-friendly public ones

### 429 Too Many Requests
**Cause**: Rate limiting
**Solution**: Add more instances for rotation, increase delay between requests

### Timeout
**Cause**: Instance is slow or down
**Solution**: Increase timeout or use different instance

## Self-Hosting SearXNG

### Docker Compose (Production Ready)

```yaml
version: '3.7'

services:
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./searxng:/etc/searxng:rw
    environment:
      - SEARXNG_BASE_URL=http://localhost:8080/
      - SEARXNG_SECRET=your-secret-key-here
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    logging:
      driver: "json-file"
      options:
        max-size: "1m"
        max-file: "1"
```

Save as `docker-compose.yml` and run:
```bash
docker-compose up -d
```

### Configuration

Edit `./searxng/settings.yml`:

```yaml
use_default_settings: true
server:
  secret_key: "your-secret-key-here"
  limiter: false  # Disable rate limiting for local use
  method: "GET"

search:
  safe_search: 0
  autocomplete: ""
  formats:
    - html
    - json

engines:
  - name: google
    disabled: false
  - name: bing
    disabled: false
  - name: duckduckgo
    disabled: false
```

## Alternative: DuckDuckGo API

If SearXNG is problematic, consider using DuckDuckGo's HTML API:

```typescript
// Not built into the library yet, but you could create a custom SearchProvider
async function duckDuckGoSearch(query: string): Promise<SearchResult[]> {
  const response = await axios.get('https://html.duckduckgo.com/html/', {
    params: { q: query },
    headers: { 'User-Agent': 'Mozilla/5.0...' }
  });
  // Parse HTML response
  return results;
}
```

## Best Practices

1. **Always include a self-hosted instance** as primary
2. **Use multiple instances** for redundancy
3. **Test instances regularly** - they go down or change policies
4. **Respect rate limits** - use rotation and delays
5. **Monitor errors** - log failed instances to identify problems

## Support

For issues with SearXNG itself:
- [SearXNG Documentation](https://docs.searxng.org/)
- [SearXNG GitHub](https://github.com/searxng/searxng)
- [Public Instances List](https://searx.space/)

For issues with this library:
- Check your instance configuration
- Test instances manually with curl
- Report library bugs with instance details
