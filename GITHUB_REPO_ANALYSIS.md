# GitHub Repository Analysis & Bounded Context Creation

## Overview

ResearchBuddy now includes a comprehensive GitHub repository analysis system that follows the bounded context playbook principles. This feature automatically analyzes GitHub repositories and creates structured, auditable contexts for codebase understanding.

## Features

### 🔍 **Automatic Repository Detection**
- Detects GitHub repository URLs automatically
- Integrates with existing URL processing workflow
- Supports both manual and automatic analysis modes

### 📊 **Comprehensive Repository Analysis**
- **Metadata Collection**: Stars, forks, issues, language, license, topics
- **Technology Stack Detection**: Frameworks, package managers, build tools
- **File Structure Analysis**: Purpose inference, dependency extraction, complexity scoring
- **Architecture Assessment**: Monolith vs modular, frontend/backend separation

### 🏗️ **Bounded Context Creation**
- **Repository Metadata Context**: Basic repository information
- **Technology Stack Context**: Build configuration and dependencies
- **File-Level Contexts**: Individual file analysis with relationships
- **Quality Assessment**: Risk identification and improvement recommendations

### 💡 **Actionable Insights**
- **Risk Assessment**: Security vulnerabilities, maintenance debt, complexity hotspots
- **Improvement Recommendations**: Quick wins, refactoring targets, testing gaps
- **Integration Opportunities**: API surface analysis, extension points

## Setup

### 1. GitHub Token Configuration

Add your GitHub personal access token to your `.env` file:

```bash
# .env
GITHUB_TOKEN=ghp_your_github_token_here
```

**Getting a GitHub Token:**
1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes: `public_repo` (for public repos) or `repo` (for private repos)
4. Copy the token and add it to your `.env` file

### 2. Environment Variables

```bash
# Required for GitHub API access
GITHUB_TOKEN=ghp_your_token_here

# Optional: Customize analysis settings
GITHUB_ANALYSIS_MAX_FILES=100
GITHUB_ANALYSIS_MAX_FILE_SIZE=100000
```

## Usage

### Automatic Analysis

GitHub repositories are automatically detected and analyzed when added through the URL processing workflow:

```bash
# Add a GitHub repository URL
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "url": "https://github.com/vercel/next.js",
    "title": "Next.js Framework"
  }'
```

### Manual Analysis

Use the test script to manually analyze a GitHub repository:

```bash
npm run test:github-analysis
```

### Programmatic Usage

```typescript
import { githubRepoAnalysisTool } from './server/mastra/tools/github-repo-analysis-tool';

const result = await githubRepoAnalysisTool.execute({
  context: {
    url: 'https://github.com/vercel/next.js',
    userId: 1,
    profileId: 0
  }
});

console.log('Analysis completed:', result.message);
```

## Analysis Output

### Repository Metadata

```json
{
  "repository": {
    "url": "https://github.com/vercel/next.js",
    "name": "vercel/next.js",
    "description": "The React Framework for Production",
    "language": "JavaScript",
    "size": 12345,
    "stars": 100000,
    "forks": 5000,
    "issues": 150,
    "lastUpdated": "2024-01-01T00:00:00Z",
    "license": "MIT",
    "topics": ["react", "nextjs", "framework"],
    "isArchived": false,
    "defaultBranch": "main"
  }
}
```

### Technology Stack

```json
{
  "techStack": {
    "primaryLanguage": "JavaScript",
    "buildFiles": ["package.json", "next.config.js", "tailwind.config.js"],
    "frameworks": ["Next.js", "Tailwind CSS"],
    "packageManagers": ["npm/yarn"],
    "databases": [],
    "deploymentTools": ["Vercel"]
  }
}
```

### Bounded Contexts

```json
{
  "contexts": [
    {
      "id": "context-1",
      "name": "repo-metadata",
      "type": "metadata",
      "description": "Repository metadata and basic information",
      "data": { /* repository metadata */ },
      "relationships": [],
      "lastUpdated": "2024-01-01T00:00:00Z",
      "cost": 0.1
    },
    {
      "id": "context-2",
      "name": "tech-stack",
      "type": "architecture",
      "description": "Technology stack and build configuration",
      "data": { /* tech stack data */ },
      "relationships": ["repo-metadata"],
      "lastUpdated": "2024-01-01T00:00:00Z",
      "cost": 0.2
    }
  ]
}
```

### Insights

```json
{
  "insights": {
    "risks": [
      "High number of open issues may indicate maintenance challenges",
      "Repository is archived - may not receive updates"
    ],
    "improvements": [
      "Add README.md for better project documentation",
      "Consider containerization for easier deployment"
    ],
    "opportunities": [
      "Next.js detected - potential for Vercel deployment",
      "Node.js project - consider adding TypeScript for type safety"
    ]
  }
}
```

## Bounded Context Principles

### 1. **Auditable**
- Each context has a unique ID and timestamp
- Cost tracking for analysis resources
- Clear relationships between contexts

### 2. **Teachable**
- Structured data format for easy consumption
- Clear descriptions and purposes
- Relationship mapping for context navigation

### 3. **Cost-Aware**
- Analysis duration tracking
- Estimated cost calculation ($0.10/minute)
- Resource usage optimization

### 4. **Bounded**
- Each context has a specific scope and purpose
- Clear boundaries between different analysis areas
- Modular design for selective updates

## Integration with Existing Features

### ChromaDB Vector Search
GitHub repository analysis results are automatically indexed in ChromaDB for semantic search:

```typescript
// Search for repositories by technology stack
const results = await storage.searchAll(userId, "Next.js React framework");
```

### Context Profiles
GitHub analysis can be associated with specific user context profiles:

```typescript
// Analyze repository in specific context
const result = await githubRepoAnalysisTool.execute({
  context: {
    url: 'https://github.com/example/repo',
    userId: 1,
    profileId: 5 // Specific context profile
  }
});
```

### Research Integration
GitHub analysis results can be used in research requests:

```typescript
// Create research request for GitHub repository
const researchRequest = await storage.createResearchRequest(userId, {
  title: "Analyze Next.js Framework Architecture",
  description: "Comprehensive analysis of Next.js codebase structure and patterns",
  researchAreas: ["architecture", "performance", "security"],
  profileId: 0
});
```

## Configuration Options

### Analysis Limits

```typescript
// Maximum files to analyze per repository
const MAX_FILES = process.env.GITHUB_ANALYSIS_MAX_FILES || 100;

// Maximum file size to analyze (bytes)
const MAX_FILE_SIZE = process.env.GITHUB_ANALYSIS_MAX_FILE_SIZE || 100000;
```

### Cost Controls

```typescript
// Cost per minute of analysis
const COST_PER_MINUTE = 0.10;

// Maximum analysis duration (minutes)
const MAX_ANALYSIS_DURATION = 30;
```

## Error Handling

### Common Issues

1. **GitHub Token Missing**
   ```
   Error: GitHub token not found in environment variables
   Solution: Add GITHUB_TOKEN to your .env file
   ```

2. **Repository Not Found**
   ```
   Error: GitHub API error: 404 Not Found
   Solution: Check repository URL and access permissions
   ```

3. **Rate Limit Exceeded**
   ```
   Error: GitHub API error: 403 Forbidden
   Solution: Wait for rate limit reset or use authenticated token
   ```

### Recovery Strategies

- **Retry Logic**: Automatic retry with exponential backoff
- **Partial Analysis**: Continue with available data if some files fail
- **Graceful Degradation**: Fall back to basic metadata if detailed analysis fails

## Performance Considerations

### Analysis Speed
- **Small Repos (< 50 files)**: ~30 seconds
- **Medium Repos (50-200 files)**: ~2-5 minutes
- **Large Repos (> 200 files)**: ~10-30 minutes

### Resource Usage
- **Memory**: ~50-200MB depending on repository size
- **Network**: GitHub API calls for metadata and file content
- **Storage**: Analysis results stored in PostgreSQL and ChromaDB

### Optimization Tips
- Limit file size analysis to avoid memory issues
- Use caching for repeated analysis of the same repository
- Batch process multiple repositories during off-peak hours

## Future Enhancements

### Planned Features
- **AST Parsing**: More accurate dependency and export analysis
- **Git History Analysis**: Commit patterns and contributor insights
- **Security Scanning**: Vulnerability detection in dependencies
- **Performance Profiling**: Code complexity and performance metrics
- **Integration Testing**: Automated testing of analysis accuracy

### Advanced Context Types
- **Module Boundaries**: Automatic module detection and mapping
- **API Surface Analysis**: Public API identification and documentation
- **Data Flow Mapping**: Input/output analysis across components
- **Security Context**: Vulnerability and compliance assessment

## Troubleshooting

### Debug Mode
Enable debug logging for detailed analysis information:

```bash
DEBUG=github-analysis npm run test:github-analysis
```

### Manual Verification
Check analysis results manually:

```bash
# Check database storage
npm run storage:check

# Verify ChromaDB indexing
npm run chroma:test
```

### Performance Monitoring
Monitor analysis performance:

```bash
# Check analysis metrics
npm run test:github-analysis | grep "Duration\|Cost"
```

## Support

For issues or questions about GitHub repository analysis:

1. Check the troubleshooting section above
2. Review the error logs for specific error messages
3. Verify GitHub token permissions and rate limits
4. Test with a simple public repository first

The GitHub repository analysis feature provides a powerful foundation for understanding codebases and creating actionable insights for development teams. 