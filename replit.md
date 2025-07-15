# Research Workspace Application

## Overview

This is a full-stack TypeScript application built with React frontend and Express backend, designed as a research workspace with URL management, AI chat capabilities, and a Q&A system. The application uses a three-panel layout with URL collection, AI chat, and "Ask Leo" functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state
- **Form Handling**: React Hook Form with Zod validation
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful API endpoints
- **Development**: Hot reload with tsx
- **Build**: esbuild for production bundling

### Database & ORM
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: Configured for PostgreSQL (via Neon Database)
- **Migrations**: Drizzle Kit for schema management
- **Schema Location**: `shared/schema.ts` for type sharing

## Key Components

### Database Schema
- **Users**: Basic user management with username/password
- **URLs**: User-specific URL collection with titles and notes
- **Chat Messages**: AI conversation history with role-based messages
- **Leo Questions**: Q&A system with pending/answered status

### API Endpoints
- `GET/POST /api/urls` - URL management
- `DELETE /api/urls/:id` - URL deletion
- `GET/POST /api/chat/messages` - Chat functionality
- `GET/POST /api/leo/questions` - Q&A system
- `PUT /api/leo/questions/:id` - Answer updates

### UI Components
- **URL Collector**: Add, view, and delete research URLs
- **AI Chat**: Real-time chat interface with OpenAI integration
- **Ask Leo**: Asynchronous Q&A system
- **Modal System**: Form dialogs for URL creation

### Third-Party Integrations
- **OpenAI API**: GPT-4o model for chat responses
- **Neon Database**: Serverless PostgreSQL hosting
- **Radix UI**: Accessible component primitives

## Data Flow

1. **URL Management**: Users add URLs through a modal form, data persists to database, UI updates via React Query cache invalidation
2. **AI Chat**: Messages sent to OpenAI API, responses stored in database, real-time UI updates
3. **Leo Q&A**: Questions submitted asynchronously, answers provided by backend processing, status tracking

## External Dependencies

### Runtime Dependencies
- **@neondatabase/serverless**: Database connection
- **drizzle-orm**: Database ORM and query builder
- **@tanstack/react-query**: Server state management
- **react-hook-form**: Form validation and submission
- **openai**: AI chat integration
- **@radix-ui/***: UI component primitives

### Development Tools
- **Vite**: Frontend build tool and dev server
- **tsx**: TypeScript execution for development
- **esbuild**: Production bundling
- **drizzle-kit**: Database schema management

## Deployment Strategy

### Build Process
1. Frontend builds with Vite to `dist/public`
2. Backend bundles with esbuild to `dist/index.js`
3. Static assets served by Express in production

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API authentication
- `NODE_ENV`: Environment mode (development/production)

### Development Workflow
- `npm run dev`: Start development server with hot reload
- `npm run build`: Production build for both frontend and backend
- `npm run db:push`: Apply database schema changes

The application is designed for Replit deployment with development banner integration and runtime error handling. The architecture supports easy scaling through serverless database and stateless API design.