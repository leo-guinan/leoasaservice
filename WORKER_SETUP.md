# Background Worker Setup

This project now includes a background worker system using Bull queues and Redis for processing tasks asynchronously.

## Features

- **URL Processing**: Automatically analyzes URLs when they're added
- **Content Analysis**: AI-powered analysis of content
- **Job Queuing**: Reliable job processing with retries and monitoring
- **Scalable**: Can run multiple worker processes

## Setup

### 1. Install Redis

```bash
# Run the setup script
./scripts/setup-redis.sh

# Or install manually
brew install redis  # macOS
sudo apt-get install redis-server  # Ubuntu/Debian
```

### 2. Environment Variables

Add these to your `.env` file:

```env
# Redis configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional

# OpenAI API key (already configured)
OPENAI_API_KEY=your-api-key
```

### 3. Database Migration

The URLs table now includes an `analysis` field. Run migrations:

```bash
pnpm run db:generate
pnpm run db:push
```

## Usage

### Development

Start the main server:
```bash
pnpm run dev
```

Start the worker process (in a separate terminal):
```bash
pnpm run dev:worker
```

### Production

Build the project:
```bash
pnpm run build
```

Start the main server:
```bash
pnpm run start
```

Start the worker process:
```bash
pnpm run start:worker
```

## How It Works

1. **URL Processing**: When a user adds a URL, it's automatically queued for background processing
2. **Content Fetching**: The worker fetches the URL content
3. **AI Analysis**: Content is analyzed using GPT-4o
4. **Storage**: Analysis results are stored in the database

## Job Types

- `url-processing`: Processes URLs and generates AI analysis
- `content-analysis`: Analyzes any content with AI

## Monitoring

You can monitor jobs using Bull's built-in UI or Redis CLI:

```bash
# Check Redis queues
redis-cli
> KEYS bull:*
> LLEN bull:url-processing:wait
```

## Scaling

To scale workers, simply run multiple worker processes:

```bash
# Terminal 1
pnpm run dev:worker

# Terminal 2  
pnpm run dev:worker

# Terminal 3
pnpm run dev:worker
```

## Error Handling

- Jobs automatically retry on failure
- Failed jobs are logged with error details
- Graceful shutdown handling

## Alternative Approaches

If you don't want to use Redis, here are other options:

### Option 2: Node.js Worker Threads
For simple background tasks without persistence.

### Option 3: Database-based Queue
Store jobs in PostgreSQL and poll for new work.

### Option 4: External Services
- AWS SQS
- Google Cloud Tasks
- Azure Service Bus

The Bull/Redis approach is recommended for production as it provides:
- Persistence
- Retry logic
- Job scheduling
- Monitoring
- Horizontal scaling 