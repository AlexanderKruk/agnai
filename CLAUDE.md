# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PornAI is an AI Roleplay Chat platform built with SolidJS frontend and Express.js backend. Users create and interact with personalized AI characters using various AI services (OpenAI, Claude, NovelAI, etc.). The platform supports group conversations, memory/lore books for context, and image generation.

**Tech Stack:**
- Frontend: SolidJS, TailwindCSS, Zustand, TypeScript
- Backend: Node.js, Express, MongoDB (optional), Redis, WebSockets
- Python Pipeline: Flask, ChromaDB, Transformers (for advanced features)
- Package Management: pnpm (JS), Poetry (Python)

## Essential Commands

### Development
```bash
npm run deps          # Install dependencies (uses pnpm)
npm run start         # Start dev environment (Mac/Linux)
npm run start:win     # Start dev environment (Windows)
npm run start:all     # Include Python pipeline features
npm run up            # Start MongoDB via Docker
```

### Build & Production
```bash
npm run build:all     # Build frontend and backend
npm run build:prod    # Production build with optimizations
npm run selfhost      # Build and run for self-hosting
```

### Testing & Quality
```bash
npm run test          # Run Mocha tests
npm run snapshot      # Update test snapshots
npm run typecheck     # TypeScript type checking
npm run check         # Run typecheck + tests
npm run format:fix    # Auto-fix formatting with Prettier
```

### Python Pipeline (Optional Features)
```bash
npm run model:init    # Initialize Python virtual environment
npm run model:deps    # Install Python dependencies
npm run model:start   # Start Python model service
npm run model         # Full model setup and start
```

## Architecture Overview

### Directory Structure
- `/web` - SolidJS frontend application
- `/srv` - Express.js backend services
- `/common` - Shared TypeScript types and utilities
- `/model` - Python Flask API for advanced features
- `/db` - Local database files (self-hosted mode)

### Key Backend Directories
- `/srv/api` - REST API endpoints
- `/srv/db` - Database models and operations
- `/srv/adapter` - AI service adapters (OpenAI, Claude, etc.)
- `/srv/domains` - Business logic domains
- `/srv/image` - Image generation services
- `/srv/voice` - Text-to-speech functionality

### Key Frontend Directories
- `/web/pages` - Page components (Chat, Character, Memory, etc.)
- `/web/shared` - Reusable UI components
- `/web/store` - Zustand state management
- `/web/tours` - User onboarding flows

### Shared Code
- `/common/types` - TypeScript interfaces and schemas
- `/common/adapters.ts` - AI service configurations
- `/common/prompt.ts` - Prompt templating system
- `/common/memory.ts` - Memory/lore book functionality

## Core Systems

### AI Service Integration
- **Adapter Pattern**: Each AI service has an adapter in `/srv/adapter/`
- **Registration**: Services registered in `/srv/adapter/register.ts`
- **Configuration**: Service configs in `/common/adapters.ts`
- **Generation Flow**: Request → Adapter → AI Service → Streaming Response

### Chat System
- **Real-time**: WebSocket communication for live chat
- **Message Storage**: MongoDB collections with JSON fallback
- **Generation**: AI responses triggered via adapter system
- **Context Management**: Token counting and history trimming

### Character Management
- **Schema**: Defined in `/common/types/schema.ts`
- **Persona Formats**: Multiple character definition formats
- **Memory Integration**: Characters can use memory/lore books
- **Image Generation**: Avatar and scene generation

### Prompt Engineering
- **Template System**: Variable substitution in `/common/template-parser.ts`
- **Prompt Building**: Core logic in `/common/prompt.ts`
- **Components**: Character persona, scenario, memory, chat history
- **Placeholders**: `{{char}}`, `{{user}}`, `{{personality}}`, `{{scenario}}`, etc.

## Common Development Patterns

### Adding a New AI Service
1. Update `/common/adapters.ts` with service definition
2. Create adapter implementation in `/srv/adapter/[service].ts`
3. Register adapter in `/srv/adapter/register.ts`
4. Add sampler settings in `/common/sampler-order.ts` if needed
5. Update UI to display the new service

### Adding Database Models
1. Define schema in `/common/types/schema.ts` (`AppSchema` namespace)
2. Create database operations in `/srv/db/[model].ts`
3. Create API endpoints in `/srv/api/[model].ts`
4. Register routes in `/srv/api/index.ts`
5. Add frontend state management in `/web/store/[model].ts`

### State Management (Frontend)
- **Zustand Stores**: Created in `/web/store/create.ts`
- **Event Communication**: Between stores via event emitters
- **Local Storage**: Synced for guest mode operation
- **SolidJS Signals**: Component-level reactivity

### API Patterns
- **RESTful Design**: Standard CRUD operations
- **WebSocket Events**: Real-time updates
- **Authentication**: JWT-based with API key support
- **Error Handling**: Consistent error responses

## Development Notes

### Database Setup
- **MongoDB**: Full mode with user accounts and persistence
- **Guest Mode**: JSON file storage when MongoDB unavailable
- **Redis**: Optional for WebSocket clustering

### Testing
- Unit tests in `/tests/` directory
- Snapshot testing for deterministic outputs
- Test utilities in `/tests/util.ts`
- Run with `npm run test`

### Type Safety
- TypeScript throughout frontend and backend
- Shared types in `/common/types/`
- Strict type checking enabled

### Performance Considerations
- Large chat histories impact prompt generation
- Memory books with many entries affect performance
- Token counting and context window management critical

### Troubleshooting
- Debug logging: `LOG_LEVEL=debug npm run start`
- WebSocket debugging via browser dev tools
- API request/response inspection in Network tab
- State debugging with Redux DevTools (for Zustand)