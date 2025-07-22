# RSS Feed & Crawler Features

## Overview

ResearchBuddy now includes comprehensive RSS feed management and web crawling capabilities to automatically discover, process, and analyze content from RSS feeds and root URLs. These features work seamlessly with the existing ChromaDB vector search and AI analysis pipeline.

## RSS Feed Management

### Features

- **Automatic RSS Feed Processing**: Fetch and analyze RSS feeds on a configurable schedule
- **AI Content Analysis**: Each RSS item is analyzed with GPT-4o for summary, topics, sentiment, and relevance
- **Vector Search Integration**: All RSS content is indexed in ChromaDB for semantic search
- **Context-Aware Storage**: RSS feeds can be associated with specific user contexts/profiles
- **Duplicate Prevention**: Smart filtering to avoid processing duplicate items
- **Configurable Fetch Intervals**: Set custom intervals for each feed (default: 24 hours)
- **Batch Processing**: Process multiple feeds efficiently

### Database Schema

#### RSS Feeds Table
```sql
CREATE TABLE rss_feeds (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL DEFAULT 0,
  feed_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  last_fetched TIMESTAMP,
  last_item_date TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  fetch_interval INTEGER NOT NULL DEFAULT 1440, -- minutes
  max_items_per_fetch INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### RSS Feed Items Table
```sql
CREATE TABLE rss_feed_items (
  id SERIAL PRIMARY KEY,
  feed_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  link TEXT NOT NULL,
  author TEXT,
  published_at TIMESTAMP,
  guid TEXT NOT NULL,
  is_processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

#### RSS Feed Management
- `GET /api/rss/feeds` - Get all RSS feeds for user
- `POST /api/rss/feeds` - Create new RSS feed
- `PUT /api/rss/feeds/:id` - Update RSS feed
- `DELETE /api/rss/feeds/:id` - Delete RSS feed

#### RSS Items
- `GET /api/rss/items` - Get RSS items (optionally filtered by feed)
- `POST /api/rss/process` - Manually trigger RSS processing

### Usage Examples

#### Adding an RSS Feed
```javascript
// Add a tech news RSS feed
const response = await fetch('/api/rss/feeds', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    feedUrl: 'https://feeds.feedburner.com/TechCrunch',
    title: 'TechCrunch',
    description: 'Latest technology news and startup information',
    profileId: 0, // Default context
    fetchInterval: 1440, // 24 hours
    maxItemsPerFetch: 20
  })
});
```

#### Processing RSS Feeds
```bash
# Process all RSS feeds for all users
npm run rss:process

# Process feeds for specific user
npm run rss:process -- --userId=1

# Process specific feed
npm run rss:process -- --feedId=5

# List all RSS feeds
npm run rss:list
```

## Web Crawler

### Features

- **Intelligent Page Discovery**: Automatically discover and crawl leaf nodes from root URLs
- **Priority-Based Processing**: Pages are scored and prioritized based on content quality and relevance
- **Depth Control**: Configurable crawl depth (default: 3 levels)
- **Rate Limiting**: Respectful crawling with configurable delays
- **AI Content Analysis**: Each discovered page is analyzed with GPT-4o
- **Vector Search Integration**: All crawled content is indexed in ChromaDB
- **Progress Tracking**: Real-time progress updates during crawling
- **Error Handling**: Robust error handling and retry logic

### Database Schema

#### Crawler Jobs Table
```sql
CREATE TABLE crawler_jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL DEFAULT 0,
  root_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  max_pages INTEGER NOT NULL DEFAULT 100,
  pages_discovered INTEGER NOT NULL DEFAULT 0,
  pages_processed INTEGER NOT NULL DEFAULT 0,
  pages_analyzed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Crawler Pages Table
```sql
CREATE TABLE crawler_pages (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL DEFAULT 0,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  content TEXT,
  analysis JSONB,
  status TEXT NOT NULL DEFAULT 'discovered',
  priority INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);
```

### API Endpoints

#### Crawler Management
- `GET /api/crawler/jobs` - Get all crawler jobs for user
- `POST /api/crawler/jobs` - Create new crawler job
- `GET /api/crawler/jobs/:id` - Get specific crawler job
- `GET /api/crawler/jobs/:id/pages` - Get pages discovered by job

### Usage Examples

#### Starting a Crawl
```javascript
// Start crawling a website
const response = await fetch('/api/crawler/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    rootUrl: 'https://example.com',
    profileId: 0, // Default context
    maxPages: 100
  })
});

const job = await response.json();
console.log(`Crawler job started: ${job.id}`);
```

#### Monitoring Crawl Progress
```javascript
// Check job status
const statusResponse = await fetch(`/api/crawler/jobs/${job.id}`);
const jobStatus = await statusResponse.json();

console.log(`Status: ${jobStatus.status}`);
console.log(`Pages discovered: ${jobStatus.pagesDiscovered}`);
console.log(`Pages analyzed: ${jobStatus.pagesAnalyzed}`);

// Get discovered pages
const pagesResponse = await fetch(`/api/crawler/jobs/${job.id}/pages`);
const pages = await pagesResponse.json();

pages.forEach(page => {
  console.log(`${page.url} - ${page.title} (Priority: ${page.priority})`);
});
```

## Integration with Existing Features

### ChromaDB Vector Search

Both RSS feeds and crawled content are automatically indexed in ChromaDB with rich metadata:

```javascript
// RSS items are indexed with:
{
  userId: 1,
  profileId: 0,
  type: 'rss_item',
  title: 'Article Title',
  url: 'https://example.com/article',
  publishedAt: '2024-01-01T00:00:00Z',
  sentiment: 'positive',
  contentType: 'article',
  relevanceScore: 8,
  timestamp: '2024-01-01T00:00:00Z'
}

// Crawled pages are indexed with:
{
  userId: 1,
  profileId: 0,
  type: 'crawler_page',
  title: 'Page Title',
  url: 'https://example.com/page',
  contentType: 'article',
  relevanceScore: 7,
  depth: 2,
  timestamp: '2024-01-01T00:00:00Z'
}
```

### AI Analysis Pipeline

All content goes through the same AI analysis pipeline:

1. **Content Extraction**: RSS items and web pages are processed for text content
2. **AI Analysis**: GPT-4o analyzes content for:
   - Summary (2-3 sentences)
   - Key topics/themes
   - Sentiment analysis
   - Content type classification
   - Relevance scoring
3. **Vector Indexing**: Analyzed content is indexed in ChromaDB
4. **Search Integration**: Content becomes searchable via semantic search

### Context Profiles

Both RSS feeds and crawler jobs can be associated with specific user context profiles:

- **Default Context (profileId: 0)**: General content for the user
- **Specific Profiles**: Content organized by research topic or project
- **Pro Mode**: Enhanced context management for power users

## Daily Processing Workflow

### RSS Feed Processing

The system includes a daily RSS processing script that can be run as a cron job:

```bash
# Add to crontab for daily processing at 6 AM
0 6 * * * cd /path/to/researchbuddy && npm run rss:process
```

The script:
1. Identifies all active RSS feeds
2. Checks if feeds are due for processing (based on fetch interval)
3. Fetches new items from each feed
4. Filters out already processed items
5. Analyzes new items with AI
6. Stores items in database and ChromaDB
7. Updates feed metadata

### Crawler Job Management

Crawler jobs are processed asynchronously:
1. User creates a crawler job via API
2. Job is queued for processing
3. Background worker processes the job
4. Progress is tracked in real-time
5. Results are stored in database and ChromaDB

## Configuration

### Environment Variables

```bash
# RSS Processing
RSS_FETCH_INTERVAL=1440  # Default fetch interval in minutes
RSS_MAX_ITEMS_PER_FETCH=50  # Default max items per fetch

# Crawler Configuration
CRAWLER_MAX_PAGES=100  # Default max pages per crawl
CRAWLER_MAX_DEPTH=3    # Default crawl depth
CRAWLER_DELAY=1000     # Delay between requests in ms
CRAWLER_TIMEOUT=30000  # Page load timeout in ms

# AI Analysis
OPENAI_API_KEY=your-openai-api-key
```

### Performance Considerations

- **RSS Processing**: Designed to handle hundreds of feeds efficiently
- **Crawler**: Respectful crawling with configurable delays and limits
- **Database**: Optimized queries and indexing for large datasets
- **ChromaDB**: Efficient vector storage and retrieval
- **Memory**: Streaming processing for large RSS feeds

## Testing

### Test Scripts

```bash
# Test RSS and crawler functionality
npm run test:rss-crawler

# Test RSS feed processing
npm run rss:process -- --feedId=1

# List all RSS feeds
npm run rss:list
```

### Manual Testing

1. **Add RSS Feed**: Use the API to add a test RSS feed
2. **Process Feed**: Manually trigger processing
3. **Verify Results**: Check database and ChromaDB for indexed content
4. **Test Search**: Use vector search to find processed content
5. **Start Crawl**: Create a crawler job for a test website
6. **Monitor Progress**: Track job status and discovered pages

## Troubleshooting

### Common Issues

1. **RSS Feed Not Processing**
   - Check if feed URL is accessible
   - Verify feed format is valid RSS/Atom
   - Check fetch interval settings

2. **Crawler Not Discovering Pages**
   - Verify root URL is accessible
   - Check if site allows crawling (robots.txt)
   - Adjust crawl depth and delay settings

3. **AI Analysis Failing**
   - Verify OpenAI API key is valid
   - Check API rate limits
   - Ensure content is not empty

4. **ChromaDB Indexing Issues**
   - Verify ChromaDB connection
   - Check collection permissions
   - Monitor disk space

### Debug Commands

```bash
# Check RSS feed status
npm run rss:list

# Test specific feed
npm run rss:process -- --feedId=1

# Check crawler jobs
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/crawler/jobs

# Test ChromaDB health
curl http://localhost:3000/api/chroma/health
```

## Future Enhancements

### Planned Features

1. **Advanced RSS Features**
   - RSS feed validation and testing
   - Custom RSS parsing rules
   - Feed categorization and tagging
   - RSS feed analytics and metrics

2. **Enhanced Crawler**
   - JavaScript rendering for SPA crawling
   - Custom crawling rules and filters
   - Sitemap-based crawling
   - Image and media content extraction

3. **Content Processing**
   - PDF document processing
   - Video transcript extraction
   - Multi-language content support
   - Content deduplication improvements

4. **Analytics and Reporting**
   - Content discovery analytics
   - Processing performance metrics
   - User engagement tracking
   - Content quality scoring

This comprehensive RSS feed and crawler system provides powerful content discovery and analysis capabilities that integrate seamlessly with ResearchBuddy's existing AI-powered research assistant features. 