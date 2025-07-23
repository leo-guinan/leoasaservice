# Research Feature Documentation

## Overview

The Research Feature is a comprehensive system that allows users to create research requests and generate detailed reports by combining local knowledge from their existing context with internet research. This feature integrates with ChromaDB for semantic search and uses AI to generate structured research reports.

## Features

### 🔍 Research Requests
- **Create Research Requests**: Users can create detailed research requests with titles, descriptions, and priority levels
- **Priority Levels**: Low, Medium, High, Urgent
- **Status Tracking**: Pending, In Progress, Completed, Cancelled
- **Context Integration**: Requests can be associated with specific context profiles

### 📊 Research Reports
- **Comprehensive Reports**: AI-generated reports that combine local and internet knowledge
- **Structured Format**: Executive Summary, Local Knowledge, Internet Research, Key Findings, Recommendations
- **Source Attribution**: Clear separation between local knowledge [LOCAL] and internet research [INTERNET]
- **Actionable Insights**: Specific recommendations based on findings

### 🔗 ChromaDB Integration
- **Semantic Search**: Search through existing URLs, chat messages, and analysis
- **Local Knowledge Discovery**: Automatically find relevant information from user's context
- **Vector Embeddings**: Store and retrieve content using embeddings for better search

## Architecture

### Database Schema

#### Research Requests Table
```sql
CREATE TABLE "research_requests" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL,
  "profile_id" integer NOT NULL DEFAULT 0,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "research_areas" jsonb,
  "priority" text NOT NULL DEFAULT 'medium',
  "status" text NOT NULL DEFAULT 'pending',
  "assigned_to" text,
  "due_date" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
```

#### Research Reports Table
```sql
CREATE TABLE "research_reports" (
  "id" serial PRIMARY KEY,
  "request_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "profile_id" integer NOT NULL DEFAULT 0,
  "title" text NOT NULL,
  "executive_summary" text,
  "local_knowledge_section" text,
  "internet_research_section" text,
  "methodology" text,
  "sources" jsonb,
  "key_findings" jsonb,
  "recommendations" jsonb,
  "status" text NOT NULL DEFAULT 'draft',
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
```

### API Endpoints

#### Research Requests
- `POST /api/research/requests` - Create a new research request
- `GET /api/research/requests` - Get all research requests for a user

#### Research Reports
- `POST /api/research/reports/generate` - Generate a research report
- `GET /api/research/reports` - Get all research reports for a user

### Storage Layer

The research feature extends the existing storage interface with new methods:

```typescript
interface IStorage {
  // Research methods
  getResearchRequests(userId: number, profileId?: number, status?: string): Promise<any[]>;
  createResearchRequest(userId: number, request: any): Promise<any>;
  updateResearchRequest(id: number, userId: number, updates: any): Promise<any | undefined>;
  deleteResearchRequest(id: number, userId: number): Promise<boolean>;
  
  getResearchReports(userId: number, profileId?: number): Promise<any[]>;
  createResearchReport(report: any): Promise<any>;
  updateResearchReport(id: number, userId: number, updates: any): Promise<any | undefined>;
  deleteResearchReport(id: number, userId: number): Promise<boolean>;
  
  // ChromaDB search methods (if available)
  searchUrlContent?(userId: number, query: string, limit?: number): Promise<any>;
  searchUrlAnalysis?(userId: number, query: string, limit?: number): Promise<any>;
  searchChatMessages?(userId: number, query: string, limit?: number): Promise<any>;
}
```

## Setup Instructions

### 1. Database Setup
```bash
# Run the research database setup script
npm run research:setup
```

This script will:
- Check if PostgreSQL is running
- Create the researchbuddy database
- Add DATABASE_URL to .env file
- Run database migrations

### 2. ChromaDB Setup (Optional)
```bash
# Recreate ChromaDB collections with embedding functions
npm run chroma:recreate
```

### 3. Test the Feature
```bash
# Test research functionality
npm run research:test
```

## Usage

### Creating a Research Request

1. **Via API**:
```bash
curl -X POST http://localhost:3000/api/research/requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI in Healthcare",
    "description": "Research current AI applications in healthcare",
    "researchAreas": ["AI", "Healthcare", "Machine Learning"],
    "priority": "high",
    "profileId": 0
  }'
```

2. **Via React Component**:
```tsx
import { ResearchManager } from './components/research-manager';

// In your app
<ResearchManager />
```

### Generating a Research Report

1. **Via API**:
```bash
curl -X POST http://localhost:3000/api/research/reports/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": 1
  }'
```

2. **Via React Component**:
The ResearchManager component provides a button to generate reports for pending requests.

## Report Structure

Each research report contains:

### Executive Summary
A concise overview of the research findings and key insights.

### Local Knowledge Section
Information from the user's existing context, marked with [LOCAL]:
- User context and research interests
- Previously saved URLs and their content
- Chat messages and conversations
- ChromaDB search results

### Internet Research Section
External research and information, marked with [INTERNET]:
- Current trends and developments
- Academic research and studies
- Industry reports and news
- Gap analysis and missing information

### Methodology
Explanation of how the research was conducted, including:
- Data sources used
- Search strategies employed
- Analysis methods applied

### Key Findings
List of the most important discoveries and insights from the research.

### Recommendations
Actionable recommendations based on the research findings.

## Integration with Existing Features

### Context Profiles
Research requests and reports can be associated with specific context profiles, allowing users to organize research by different projects or areas of interest.

### ChromaDB Vector Search
The research feature leverages ChromaDB to search through:
- URL content embeddings
- URL analysis embeddings
- Chat message embeddings

This enables semantic search across the user's existing knowledge base.

### Daily Context Updates
Research reports are designed to be generated after daily context updates have run, ensuring they include the latest information from the user's research activities.

## Future Enhancements

### Planned Features
1. **Automated Report Generation**: Scheduled reports based on research requests
2. **Collaborative Research**: Share research requests and reports with team members
3. **Advanced Analytics**: Research trends and patterns analysis
4. **Export Options**: PDF, Word, and Markdown export formats
5. **Research Templates**: Pre-defined research request templates for common topics

### Technical Improvements
1. **Real-time Updates**: WebSocket integration for live report generation status
2. **Caching**: Redis caching for frequently accessed research data
3. **Search Optimization**: Improved ChromaDB search algorithms
4. **Report Versioning**: Track changes and updates to research reports

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running
   - Check DATABASE_URL in .env file
   - Run `npm run research:setup` to fix database issues

2. **ChromaDB Search Failures**
   - Run `npm run chroma:recreate` to fix embedding function issues
   - Check ChromaDB connection and API keys

3. **Report Generation Failures**
   - Verify OpenAI API key is set
   - Check user context and ChromaDB data availability
   - Review server logs for detailed error messages

### Debug Commands
```bash
# Test database connection
npm run db:test-connection

# Test ChromaDB integration
npm run chroma:test

# Test research functionality
npm run research:test
```

## Contributing

When contributing to the research feature:

1. **Follow the existing patterns** for API routes, storage methods, and React components
2. **Add comprehensive tests** for new functionality
3. **Update documentation** for any new features or changes
4. **Consider backward compatibility** when modifying existing APIs
5. **Test with both memory and PostgreSQL storage** implementations

## License

This research feature is part of the ResearchBuddy project and follows the same licensing terms. 