# ResearchBuddy Data Flow Diagram

## Complete System Data Flow

```mermaid
graph TB
    %% User Interface Layer
    subgraph "Frontend (React)"
        UI[User Interface]
        Auth[Authentication]
        Search[Search Interface]
        Chat[Chat Interface]
        URL[URL Management]
    end

    %% API Layer
    subgraph "Backend API (Express)"
        API[API Gateway]
        AuthMiddleware[JWT Auth]
        Routes[Route Handlers]
        Storage[Storage Layer]
        ChromaStorage[ChromaDB Storage]
    end

    %% Background Processing
    subgraph "Worker Process (BullMQ)"
        Worker[Worker Process]
        URLQueue[URL Processing Queue]
        AnalysisQueue[Content Analysis Queue]
        Progress[Progress Tracking]
    end

    %% AI Framework
    subgraph "Mastra AI Framework"
        Workflows[Workflows]
        Agents[AI Agents]
        Tools[AI Tools]
        Context[Context Management]
    end

    %% Data Storage
    subgraph "Data Layer"
        subgraph "PostgreSQL (Primary DB)"
            Users[(Users)]
            URLs[(URLs)]
            ChatMessages[(Chat Messages)]
            Contexts[(User Contexts)]
            Profiles[(Context Profiles)]
        end
        
        subgraph "ChromaDB (Vector DB)"
            ChatVectors[(Chat Vectors)]
            URLVectors[(URL Vectors)]
            AnalysisVectors[(Analysis Vectors)]
        end
        
        subgraph "Redis (Queue/Cache)"
            Sessions[(Sessions)]
            Queues[(Job Queues)]
            Cache[(Cache)]
        end
    end

    %% External Services
    subgraph "External APIs"
        OpenAI[OpenAI GPT-4o]
        WebScraping[Web Scraping]
        RSS[RSS Feeds]
        Weather[Weather API]
    end

    %% Data Flow Connections
    
    %% User Interactions
    UI --> API
    Auth --> API
    Search --> API
    Chat --> API
    URL --> API

    %% API Processing
    API --> AuthMiddleware
    AuthMiddleware --> Routes
    Routes --> Storage
    Routes --> ChromaStorage

    %% Storage Operations
    Storage --> Users
    Storage --> URLs
    Storage --> ChatMessages
    Storage --> Contexts
    Storage --> Profiles

    %% Vector Storage
    ChromaStorage --> ChatVectors
    ChromaStorage --> URLVectors
    ChromaStorage --> AnalysisVectors

    %% Background Processing
    API --> URLQueue
    URLQueue --> Worker
    Worker --> Workflows
    Worker --> Progress

    %% AI Processing
    Workflows --> Agents
    Agents --> Tools
    Tools --> Context
    Context --> OpenAI
    Context --> WebScraping
    Context --> RSS
    Context --> Weather

    %% Queue Management
    Worker --> Queues
    API --> Sessions
    API --> Cache

    %% Data Updates
    Workflows --> Storage
    Workflows --> ChromaStorage
    Agents --> Storage
    Tools --> Storage

    %% Styling
    classDef frontend fill:#e1f5fe
    classDef api fill:#f3e5f5
    classDef worker fill:#fff3e0
    classDef ai fill:#e8f5e8
    classDef storage fill:#fce4ec
    classDef external fill:#f1f8e9

    class UI,Auth,Search,Chat,URL frontend
    class API,AuthMiddleware,Routes,Storage,ChromaStorage api
    class Worker,URLQueue,AnalysisQueue,Progress worker
    class Workflows,Agents,Tools,Context ai
    class Users,URLs,ChatMessages,Contexts,Profiles,ChatVectors,URLVectors,AnalysisVectors,Sessions,Queues,Cache storage
    class OpenAI,WebScraping,RSS,Weather external
```

## Detailed Data Flow Scenarios

### 1. User Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant S as Server
    participant P as PostgreSQL
    participant R as Redis

    U->>C: Enter credentials
    C->>S: POST /api/auth/login
    S->>P: Query user by username
    P-->>S: User data
    S->>S: Verify password hash
    S->>S: Generate JWT token
    S->>R: Store session data
    S-->>C: JWT token + user data
    C->>C: Store token in localStorage
    C-->>U: Redirect to dashboard
```

### 2. URL Processing Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant S as Server
    participant P as PostgreSQL
    participant R as Redis
    participant W as Worker
    participant M as Mastra
    participant O as OpenAI
    participant CD as ChromaDB

    U->>C: Add URL
    C->>S: POST /api/urls
    S->>P: Create URL record
    P-->>S: URL ID
    S->>R: Add to processing queue
    S-->>C: URL created
    C-->>U: Show success message

    R->>W: Process URL job
    W->>M: Start URL processing workflow
    M->>M: Determine URL type (root/leaf)
    M->>O: Fetch and analyze content
    O-->>M: Content + analysis
    M->>P: Update URL with content
    M->>CD: Index content in ChromaDB
    M->>P: Store analysis results
    M->>CD: Index analysis in ChromaDB
    M-->>W: Processing complete
    W->>R: Mark job complete
```

### 3. Chat Message Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant S as Server
    participant P as PostgreSQL
    participant O as OpenAI
    participant CD as ChromaDB
    participant M as Mastra

    U->>C: Send message
    C->>S: POST /api/chat/messages
    S->>P: Save user message
    S->>CD: Index message in ChromaDB
    S->>M: Get user context
    M->>P: Query user context data
    M-->>S: Context-aware prompt
    S->>O: Generate AI response
    O-->>S: AI response
    S->>P: Save AI message
    S->>CD: Index AI message in ChromaDB
    S-->>C: Both messages
    C-->>U: Display conversation
```

### 4. Vector Search Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant S as Server
    participant CD as ChromaDB

    U->>C: Enter search query
    C->>S: GET /api/search/all?query=...
    S->>CD: Search chat_messages collection
    S->>CD: Search url_content collection
    S->>CD: Search url_analysis collection
    CD-->>S: Search results
    S-->>C: Combined results
    C-->>U: Display search results
```

### 5. Background Processing Flow

```mermaid
sequenceDiagram
    participant S as Server
    participant R as Redis
    participant W as Worker
    participant M as Mastra
    participant P as PostgreSQL
    participant CD as ChromaDB

    S->>R: Add job to queue
    R->>W: Process job
    W->>W: Update job progress
    W->>M: Execute workflow
    M->>P: Read/write data
    M->>CD: Index data
    M-->>W: Workflow complete
    W->>R: Mark job complete
    W->>R: Store job results
```

### 6. Context Generation Flow

```mermaid
sequenceDiagram
    participant S as Server
    participant M as Mastra
    participant P as PostgreSQL
    participant O as OpenAI
    participant CD as ChromaDB

    S->>M: Trigger context generation
    M->>P: Query user data (URLs, messages)
    P-->>M: User activity data
    M->>CD: Search relevant content
    CD-->>M: Related content
    M->>O: Generate context summary
    O-->>M: Context analysis
    M->>P: Store updated context
    M->>CD: Index context data
    M-->>S: Context generation complete
```

## Data Storage Schema

### PostgreSQL Tables

```mermaid
erDiagram
    users {
        int id PK
        string username UK
        string password
        string role
        boolean proMode
    }
    
    urls {
        int id PK
        int userId FK
        string url
        string title
        string notes
        text content
        jsonb analysis
        timestamp createdAt
    }
    
    chat_messages {
        int id PK
        int userId FK
        text content
        string role
        timestamp createdAt
    }
    
    user_contexts {
        int id PK
        int userId FK
        jsonb context
        timestamp lastUpdated
        int version
    }
    
    user_context_profiles {
        int id PK
        int userId FK
        string name
        string description
        boolean isActive
        timestamp createdAt
        timestamp updatedAt
    }
    
    context_urls {
        int id PK
        int profileId FK
        int userId FK
        string url
        string title
        string notes
        text content
        jsonb analysis
        timestamp createdAt
    }
    
    context_chat_messages {
        int id PK
        int profileId FK
        int userId FK
        text content
        string role
        timestamp createdAt
    }
    
    leo_questions {
        int id PK
        int userId FK
        text question
        string status
        text answer
        timestamp createdAt
        timestamp answeredAt
    }

    users ||--o{ urls : "owns"
    users ||--o{ chat_messages : "sends"
    users ||--o{ user_contexts : "has"
    users ||--o{ user_context_profiles : "creates"
    users ||--o{ context_urls : "owns"
    users ||--o{ context_chat_messages : "sends"
    users ||--o{ leo_questions : "asks"
    user_context_profiles ||--o{ context_urls : "contains"
    user_context_profiles ||--o{ context_chat_messages : "contains"
```

### ChromaDB Collections

```mermaid
graph LR
    subgraph "ChromaDB Collections"
        ChatCollection[chat_messages]
        URLCollection[url_content]
        AnalysisCollection[url_analysis]
    end
    
    subgraph "Metadata Fields"
        ChatMeta[userId, role, timestamp, messageId]
        URLMeta[userId, url, title, urlId, timestamp]
        AnalysisMeta[userId, url, urlId, analysisType, timestamp]
    end
    
    ChatCollection --> ChatMeta
    URLCollection --> URLMeta
    AnalysisCollection --> AnalysisMeta
```

## Queue Processing Flow

```mermaid
graph TD
    subgraph "Queue System"
        URLJob[URL Processing Job]
        AnalysisJob[Content Analysis Job]
        Progress[Progress Tracking]
        Retry[Retry Logic]
    end
    
    subgraph "Job States"
        Pending[Pending]
        Processing[Processing]
        Completed[Completed]
        Failed[Failed]
        Retrying[Retrying]
    end
    
    subgraph "Processing Steps"
        Fetch[Fetch Content]
        Analyze[AI Analysis]
        Store[Store Results]
        Index[Index in ChromaDB]
    end
    
    URLJob --> Pending
    Pending --> Processing
    Processing --> Fetch
    Fetch --> Analyze
    Analyze --> Store
    Store --> Index
    Index --> Completed
    
    Processing --> Failed
    Failed --> Retry
    Retry --> Retrying
    Retrying --> Processing
```

## Security Flow

```mermaid
graph TD
    subgraph "Security Layers"
        Auth[Authentication]
        Authz[Authorization]
        Validation[Input Validation]
        Sanitization[Data Sanitization]
    end
    
    subgraph "Security Checks"
        JWT[JWT Verification]
        Role[Role Check]
        UserData[User Data Isolation]
        RateLimit[Rate Limiting]
    end
    
    subgraph "Data Protection"
        Hash[Password Hashing]
        Encrypt[Data Encryption]
        Audit[Audit Logging]
        Backup[Backup Strategy]
    end
    
    Auth --> JWT
    Authz --> Role
    Validation --> UserData
    Sanitization --> RateLimit
    
    JWT --> Hash
    Role --> Encrypt
    UserData --> Audit
    RateLimit --> Backup
```

This comprehensive data flow diagram shows all the major components and their interactions in the ResearchBuddy system, from user input through processing to storage and retrieval. 