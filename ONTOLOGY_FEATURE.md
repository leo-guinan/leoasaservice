# Ontology Generation Feature

## Overview

The ontology generation feature allows users to create structured knowledge graphs from their research context data. This feature is available for pro mode users and generates ontologies that can be stored in both the database and ChromaDB for semantic search.

## Features

### 1. Ontology Generation Tool (`ontology-tool.ts`)
- **Location**: `server/mastra/tools/ontology-tool.ts`
- **Purpose**: Generates ontologies from user context data
- **Input Parameters**:
  - `userId`: User ID
  - `profileId`: Profile ID (0 for default context)
  - `name`: Ontology name
  - `description`: Optional description
  - `domain`: Domain/topic area
  - `includeUrls`: Include URL content (default: true)
  - `includeChatHistory`: Include chat history (default: true)
  - `maxConcepts`: Maximum concepts to generate (default: 50)
  - `confidenceThreshold`: Minimum confidence (default: 0.7)

### 2. Ontology Agent (`ontology-agent.ts`)
- **Location**: `server/mastra/agents/ontology-agent.ts`
- **Purpose**: AI agent that uses the ontology tool to generate comprehensive ontologies
- **Capabilities**:
  - Analyzes user research data
  - Extracts key concepts and relationships
  - Creates structured knowledge representations
  - Provides insights about research domains

### 3. Database Schema
- **Table**: `ontologies`
- **Fields**:
  - `id`: Primary key
  - `userId`: User ID
  - `profileId`: Profile ID (0 for default context)
  - `name`: Ontology name
  - `description`: Optional description
  - `domain`: Domain/topic area
  - `version`: Version tracking
  - `concepts`: JSON array of concept objects
  - `relationships`: JSON array of relationship objects
  - `metadata`: Additional metadata
  - `isActive`: Whether ontology is active
  - `generatedFrom`: Information about source data
  - `createdAt`/`updatedAt`: Timestamps

### 4. ChromaDB Integration
- **Collection**: `ontologies`
- **Purpose**: Semantic search and retrieval of ontologies
- **Metadata**: Includes user ID, profile ID, ontology ID, domain, version, and timestamp

### 5. Storage Methods
- **Location**: `server/storage.ts` and `server/postgres-storage.ts`
- **Methods**:
  - `getOntologies(userId, profileId?)`: Get user's ontologies
  - `createOntology(userId, profileId, ontology)`: Create new ontology
  - `updateOntology(id, userId, updates)`: Update existing ontology
  - `deleteOntology(id, userId)`: Delete ontology
  - `getActiveOntology(userId, profileId?)`: Get active ontology

## Usage

### 1. Generate Ontology via Agent
```typescript
// The ontology agent can be used to generate ontologies
// It will analyze user context and create comprehensive knowledge graphs
```

### 2. Direct Tool Usage
```typescript
import { ontologyTool } from './server/mastra/tools/ontology-tool';

const result = await ontologyTool.execute({
  userId: 1,
  profileId: 0, // Default context
  name: 'AI Research Ontology',
  description: 'Knowledge graph of AI research areas',
  domain: 'Technology',
  includeUrls: true,
  includeChatHistory: true,
  maxConcepts: 50,
  confidenceThreshold: 0.7
});
```

### 3. Database Operations
```typescript
import { storage } from './server/storage';

// Create ontology
const ontology = await storage.createOntology(userId, profileId, ontologyData);

// Get user's ontologies
const ontologies = await storage.getOntologies(userId);

// Get active ontology
const activeOntology = await storage.getActiveOntology(userId);
```

### 4. ChromaDB Search
```typescript
import { chromaService } from './server/chroma';

// Search ontologies
const results = await chromaService.searchOntologies(userId, 'artificial intelligence', 10);

// Get user's ontologies from ChromaDB
const ontologies = await chromaService.getOntologiesByUser(userId);
```

## Ontology Structure

### Concepts
Each concept contains:
- `id`: Unique identifier
- `name`: Concept name
- `description`: Concept description
- `type`: Concept type (e.g., 'Entity', 'Technology')
- `confidence`: Confidence score (0-1)
- `sources`: Data sources used
- `properties`: Additional properties

### Relationships
Each relationship contains:
- `id`: Unique identifier
- `source`: Source concept ID
- `target`: Target concept ID
- `type`: Relationship type (e.g., 'contains', 'related_to')
- `description`: Relationship description
- `confidence`: Confidence score (0-1)

## Requirements

- **Pro Mode**: Users must have pro mode enabled
- **Data**: Requires URLs, chat messages, or context data
- **ChromaDB**: Optional but recommended for semantic search

## Testing

Run the test script to verify functionality:
```bash
npx tsx scripts/test-ontology-generation.ts
```

## Migration

The ontology table is created via Drizzle migration:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

## Future Enhancements

1. **AI-Powered Generation**: Integrate with advanced AI models for better concept extraction
2. **Visualization**: Add ontology visualization capabilities
3. **Export**: Support for exporting ontologies in various formats (RDF, OWL, etc.)
4. **Collaboration**: Allow sharing and collaboration on ontologies
5. **Versioning**: Enhanced versioning and diff capabilities
6. **Integration**: Better integration with research workflows 