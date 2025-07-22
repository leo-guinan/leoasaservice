# ChromaDB Integration

This document describes the ChromaDB integration for ResearchBuddy, which provides vector search capabilities for chat messages, URL content, and URL analysis.

## Overview

ChromaDB is integrated as an enhancement layer on top of the existing storage system. It automatically indexes:
- **Chat Messages**: All user and assistant messages
- **URL Content**: The text content extracted from saved URLs
- **URL Analysis**: AI-generated analysis of URL content

## Configuration

### Environment Variables

Create a `.env` file with the following ChromaDB configuration:

```bash
# ChromaDB Configuration
CHROMA_API_KEY=your_api_key_here
CHROMA_TENANT=your_tenant_id_here
CHROMA_DATABASE=your_database_name_here
```

You can use the provided setup script:
```bash
npm run chroma:setup-env
```

### Dependencies

The following packages are required:
- `chromadb` - ChromaDB client library
- `@chroma-core/default-embed` - Default embedding function

Install with:
```bash
npm install chromadb @chroma-core/default-embed
```

## Architecture

### Storage Enhancement

The integration uses a decorator pattern to enhance the existing storage system:

```typescript
// Base storage (PostgreSQL or Memory)
const baseStorage = new PostgresStorage(); // or MemStorage

// ChromaDB-enhanced storage
const chromaStorage = createChromaStorage(baseStorage);
```

### Collections

Three ChromaDB collections are created:

1. **`chat_messages`** - Stores chat messages with metadata
2. **`url_content`** - Stores URL content with metadata  
3. **`url_analysis`** - Stores URL analysis with metadata

### Data Flow

1. **Chat Messages**: When a message is created via `createChatMessage()`, it's automatically added to ChromaDB
2. **URL Content**: When URL content is updated via `updateUrlContent()`, it's indexed in ChromaDB
3. **URL Analysis**: When analysis is added via `updateUrlAnalysis()`, it's stored in ChromaDB

## API Endpoints

### Search Endpoints

- `GET /api/search/chat?query=<query>&limit=<limit>` - Search chat messages
- `GET /api/search/urls?query=<query>&limit=<limit>` - Search URL content
- `GET /api/search/analysis?query=<query>&limit=<limit>` - Search URL analysis
- `GET /api/search/all?query=<query>&limit=<limit>` - Search all collections

### Health Check

- `GET /api/chroma/health` - Check ChromaDB connection status

## Usage Examples

### Basic Search

```typescript
// Search all collections
const results = await storage.searchAll(userId, "machine learning", 5);

// Search specific collection
const chatResults = await storage.searchChatMessages(userId, "AI", 10);
const urlResults = await storage.searchUrlContent(userId, "research", 10);
const analysisResults = await storage.searchUrlAnalysis(userId, "sentiment", 10);
```

### Frontend Component

Use the `ChromaSearch` component for a complete search interface:

```tsx
import { ChromaSearch } from './components/chroma-search';

function App() {
  return (
    <div>
      <ChromaSearch />
    </div>
  );
}
```

## Testing

### Run Integration Tests

```bash
npm run chroma:test
```

This will test:
- ChromaDB initialization
- Health checks
- Data insertion
- Search functionality
- Cleanup operations

### Cleanup Collections

```bash
npm run chroma:delete-all
```

## Data Structure

### Chat Message Document

```typescript
interface ChatMessageDocument {
  id: string;
  content: string;
  metadata: {
    userId: number;
    role: 'user' | 'assistant';
    timestamp: string;
    messageId: number;
  };
}
```

### URL Content Document

```typescript
interface UrlContentDocument {
  id: string;
  content: string;
  metadata: {
    userId: number;
    url: string;
    title?: string;
    urlId: number;
    timestamp: string;
  };
}
```

### URL Analysis Document

```typescript
interface UrlAnalysisDocument {
  id: string;
  content: string; // JSON stringified analysis
  metadata: {
    userId: number;
    url: string;
    urlId: number;
    analysisType: string;
    timestamp: string;
  };
}
```

## Error Handling

The integration includes comprehensive error handling:

- **Graceful Degradation**: If ChromaDB is unavailable, the base storage continues to work
- **Error Logging**: All ChromaDB errors are logged but don't break the application
- **Health Checks**: Regular health checks ensure ChromaDB availability

## Performance Considerations

- **Batch Operations**: Consider batching multiple documents for better performance
- **Indexing Strategy**: Documents are indexed immediately upon creation
- **Search Limits**: Default search limits prevent excessive resource usage
- **Connection Pooling**: ChromaDB client handles connection management

## Troubleshooting

### Common Issues

1. **Missing Embedding Function**
   ```
   Error: Cannot instantiate a collection with the DefaultEmbeddingFunction
   ```
   **Solution**: Install `@chroma-core/default-embed`

2. **Authentication Errors**
   ```
   Error: Invalid API key or tenant
   ```
   **Solution**: Verify your ChromaDB credentials in `.env`

3. **Collection Not Found**
   ```
   Error: Collection does not exist
   ```
   **Solution**: Collections are created automatically on first use

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
DEBUG=chromadb:*
```

## Future Enhancements

- **Custom Embeddings**: Support for custom embedding functions
- **Batch Processing**: Bulk indexing for existing data
- **Advanced Queries**: Complex filtering and aggregation
- **Real-time Updates**: WebSocket-based real-time search updates
- **Analytics**: Search analytics and usage metrics 