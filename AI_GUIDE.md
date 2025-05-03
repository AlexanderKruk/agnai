# AI Guide - Agnaistic

## Project Overview
- Purpose: AI Roleplay Chat platform enabling conversations with personalized AI characters
- Main functionality: Create and interact with AI characters using various AI services (OpenAI, Claude, Novel, etc.), participate in group conversations, utilize memory/lore books for context, and generate images
- Live version: https://agnai.chat
- Originally based on Galatea-UI by PygmalionAI
- Supports multiple AI service integrations, various persona formats, user authentication, and optional features like long-term memory
- Runs in full mode with MongoDB and Redis, or "Guest Only" mode without a database

## Tech Stack
- Frontend:
  - SolidJS: Main UI framework for reactive components
  - TailwindCSS: Utility-first CSS framework for styling
  - Zustand: State management
  - Vite: Build tool and development server
  - TypeScript: Type-safe JavaScript
  - Solid Router: Client-side routing
  - Lucide icons: Icon library
  - Sortable.js: Drag and drop functionality
  - Shepherd.js: User onboarding tours
  - Cytoscape: Graph visualization
- Backend:
  - Node.js: Server runtime
  - Express: Web server framework
  - MongoDB: NoSQL database for data storage (optional)
  - Redis: Caching and WebSocket messaging
  - JWT: Authentication tokens
  - WebSockets: Real-time communication
  - Multer: File uploads
  - Pino: Logging
- Python Pipeline Features:
  - Flask: API server for AI pipeline
  - Transformers: Hugging Face library for NLP models
  - Sentence-transformers: Text embeddings
  - Accelerate: GPU acceleration
  - ChromaDB: Vector database for embeddings
  - bitsandbytes: Model quantization
- Package Management:
  - pnpm: JavaScript dependencies
  - Poetry: Python dependencies
- Deployment:
  - Docker: Containerization
  - LocalTunnel: Expose local server to the internet (development)

## Project Structure
- `/app` or `/web`: Frontend components and logic
  - `/web/pages`: Page components organized by feature (Chat, Character, Memory, etc.)
  - `/web/shared`: Reusable components
  - `/web/store`: State management (Zustand stores)
  - `/web/icons`: SVG icons used throughout the app
  - `/web/tours`: Onboarding tour configurations
  - `App.tsx`: Main application component
  - `Navigation.tsx`: Main navigation component
- `/srv`: Backend services
  - `/srv/api`: API endpoints
  - `/srv/db`: Database models and queries
  - `/srv/domains`: Business logic domains
  - `/srv/adapter`: AI service adapters for different providers
  - `/srv/image`: Image generation and processing
  - `/srv/voice`: Text-to-speech functionality
  - `config.ts`: Server configuration
  - `middleware.ts`: Express middleware
  - `app.ts`: Express app setup
  - `server.ts`: HTTP server setup
- `/common`: Shared code between frontend and backend
  - `/common/types`: TypeScript interfaces and type definitions
  - `/common/presets`: Generation preset definitions
  - `/common/valid`: Validation utilities
  - `adapters.ts`: AI adapter configurations
  - `characters.ts`: Character schema definitions
  - `memory.ts`: Memory/Lore book functionality
  - `prompt.ts`: Prompt templating and generation
- `/model`: Python code for AI pipeline features
  - `app.py`: Main Flask application
  - `memory.py`: Long-term memory implementation
  - `summary.py`: Text summarization
- `/dist`: Compiled frontend and backend code
- `/db`: Local database files (when running MongoDB locally)
- `/static`: Static assets
- Other key files:
  - `package.json`: Node.js dependencies and scripts
  - `pyproject.toml`: Python dependencies for pipeline features
  - `vite.config.ts`: Frontend build configuration
  - `tsconfig.json`: TypeScript configuration
  - `tailwind.config.js`: TailwindCSS configuration
  - `settings.json`: Application settings (custom file for self-hosting)

## Key Features and Their Implementation
- Authentication:
  - Implementation: `/srv/api/auth.ts`, `/srv/middleware.ts`, `/srv/db/user.ts`
  - JWT-based authentication with bearer tokens
  - API key support for programmatic access
  - Login implementation: `/web/store/user.ts` and `/srv/api/user/auth.ts`

- AI Service Integration:
  - Implementation: `/srv/adapter/` directory contains adapters for each AI service
  - Service registration: `/srv/adapter/register.ts`
  - Service configuration: `/common/adapters.ts` defines available services
  - User service settings: `/srv/api/user/services.ts`
  - Model sampling configuration: `/common/sampler-order.ts`

- Chat System:
  - Message schema: `/common/types/schema.ts` (ChatMessage interface)
  - Message creation: `/srv/api/chat/message.ts`
  - Message storage: `/srv/db/messages.ts`
  - Chat UI: `/web/pages/Chat/` directory
  - Real-time communication using WebSockets

- Character Management:
  - Character schema: `/common/types/library.ts` and `/common/types/schema.ts`
  - Character creation/editing: `/srv/api/character.ts`
  - Character database operations: `/srv/db/characters.ts`
  - Character UI: `/web/pages/Character/` directory
  - Persona formats for character definitions

- Memory/Lore Books:
  - Implementation: `/common/memory.ts` for core functionality
  - Memory storage: `/srv/db/memory.ts`
  - Memory UI: `/web/pages/Memory/` directory
  - Memory prompt building: `buildMemoryPrompt()` in `/common/memory.ts`
  - Character book integration: `/web/pages/Character/form/MemoryBookPicker.tsx`

- Image Generation:
  - Core implementation: `/srv/image/index.ts`
  - Service adapters: `/srv/image/novel.ts`, `/srv/image/stable-diffusion.ts`, `/srv/image/horde.ts`
  - Frontend API: `/web/store/data/image.ts`
  - Horde integration: `/common/horde-gen.ts`
  - Image UI components in various parts of the application

- Pipeline Features (Long-term memory, PDF embedding):
  - Python implementation: `/model/` directory
  - Memory implementation: `/model/memory.py`
  - Summary generation: `/model/summary.py`
  - Flask API: `/model/app.py`
  - Integration with main app via HTTP

## API Services
- Chat API (`/srv/api/chat/`): 
  - Message endpoints:
    - `POST /chat/:id/send` - Send a message in a chat
    - `POST /chat/:id/generate` - Generate an AI response
    - `GET /chat/:id/messages` - Get messages for a chat
    - `PUT /chat/:id/message` - Update a message
    - `DELETE /chat/:id/messages` - Delete messages
  - Chat management:
    - `GET /chat` - Get all chats
    - `POST /chat` - Create a new chat
    - `GET /chat/:id` - Get chat details
    - `PUT /chat/:id` - Update chat settings
    - `DELETE /chat/:id` - Delete a chat
    - `POST /chat/import` - Import a chat
  - Group chats:
    - `POST /chat/:id/invite` - Invite a user to a chat
    - `POST /chat/:id/characters` - Add a character to a chat
    - `DELETE /chat/:id/characters/:charId` - Remove a character from a chat
  - AI features:
    - `POST /chat/inference` - Get a completion from an AI
    - `POST /chat/:id/image` - Generate an image
    - `POST /chat/:id/voice` - Text-to-speech conversion

- Character API (`/srv/api/character.ts`):
  - `GET /character` - Get all characters
  - `POST /character` - Create a new character
  - `GET /character/:id` - Get a specific character
  - `PUT /character/:id` - Update a character
  - `DELETE /character/:id` - Delete a character
  - `POST /character/image` - Generate an image for a character

- User API (`/srv/api/user/`):
  - Authentication:
    - `POST /user/login` - Log in
    - `POST /user/register` - Create an account
    - `POST /user/password-reset` - Reset password
  - User management:
    - `GET /user/profile` - Get user profile
    - `PUT /user/profile` - Update profile
    - `DELETE /user` - Delete user account
  - Settings:
    - `GET /user/settings` - Get user settings
    - `PUT /user/settings` - Update user settings
    - `GET /user/presets` - Get generation presets
    - `POST /user/presets` - Create a preset
    - `PUT /user/presets/:id` - Update a preset
  - Service configuration:
    - `GET /user/services` - Get available AI services
    - `PUT /user/services/:service` - Update service settings

- Memory API (`/srv/api/memory/`):
  - `GET /memory` - Get all memory books
  - `POST /memory` - Create a new memory book
  - `GET /memory/:id` - Get a specific memory book
  - `PUT /memory/:id` - Update a memory book
  - `DELETE /memory/:id` - Delete a memory book

- Pipeline API (Python API at port 5001):
  - `GET /pipeline/status` - Check pipeline status
  - `POST /pipeline/summarize` - Create a summary from text
  - Memory integration endpoints for vector embeddings

- Other APIs:
  - Admin API: User management, subscription management
  - Settings API: Global application settings
  - Voice API: Text-to-speech configuration
  - Horde API: Integration with AI Horde service
  - Scenario API: Managing conversation scenarios
  - Subscriptions API: Subscription management
  - Announcements API: System announcements
  
- V1 REST API (for programmatic access):
  - `POST /v1/completions` - Get a completion from an AI
  - `POST /v1/chat/completions` - Get a chat completion
  - `GET /v1/models` - List available models
  - `POST /v1/image` - Generate an image

## Development Workflow
- Local Development Setup:
  - Prerequisites:
    - Node.js (required)
    - MongoDB (optional - project runs in Guest Mode without it)
    - Redis (optional - for multi-instance WebSocket support)
    - pnpm v8+ (installed via npm scripts)
    - Python 3.10+ (for Pipeline features)
    - Poetry (for Python dependency management)
  
  - Initial Setup:
    ```bash
    # Clone the repository
    git clone https://github.com/agnaistic/agnai
    cd agnai
    
    # Install dependencies (automatically uses pnpm)
    npm run deps
    
    # Build the project
    npm run build:all
    ```

- Running the Project:
  - Basic Run:
    ```bash
    # For Mac/Linux
    npm run start
    
    # For Windows
    npm run start:win
    ```
  
  - Run with Pipeline Features (long-term memory):
    ```bash
    # For Mac/Linux
    npm run start:all
    
    # For Windows
    npm run start:all:win
    ```
  
  - Run with MongoDB (using Docker):
    ```bash
    npm run up  # Starts MongoDB in Docker
    npm run start
    ```

- Code Organization:
  - Frontend code changes in `/web` directory
  - Backend code in `/srv` directory
  - Shared code in `/common` directory
  - Python pipeline code in `/model` directory

- Key npm Scripts:
  - `npm run deps` - Install or update dependencies
  - `npm run build:all` - Build frontend and backend
  - `npm run start` - Run the development server with hot reloading
  - `npm run model` - Run the Python pipeline API
  - `npm run format:fix` - Fix code style issues automatically
  - `npm run typecheck` - Run TypeScript type checking
  - `npm run test` - Run test suite
  - `npm run selfhost` - Build and run for self-hosting

- Testing Procedures:
  - Unit tests located in `/tests` directory
  - Run tests with `npm run test`
  - Update snapshots with `npm run snapshot`
  - Tests cover prompt templates, parsing, chat models, etc.

- Debugging Tools:
  - VSCode launch configuration for Node.js debugging
  - Chrome DevTools for frontend debugging
  - Redux DevTools for state management inspection
  - Node.js inspector for backend debugging
  - Extensive logging via Pino

- Recommended Development Tools:
  - VSCode with recommended extensions:
    - Prettier
    - TailwindCSS Intellisense
  - Browser extensions:
    - Redux DevTools

## Common Implementation Patterns
- How to add a new AI service:
  1. Define the adapter in `/common/adapters.ts`:
     - Add the new service to the `AIAdapter` type
     - Update `ADAPTER_LABELS` with a display name
     - Add the service to appropriate maps like `INSTRUCT_SERVICES`
  2. Create an adapter implementation in `/srv/adapter/`:
     - Implement the `ModelAdapter` interface
     - Handle service-specific request formatting and response parsing
  3. Register the adapter in `/srv/api/index.ts`:
     - Use `registerAdapter(name, handler, options)`
     - Define the adapter's settings and configuration options
  4. Add sampler settings in `/common/sampler-order.ts` if needed
  5. Update UI components to display the new service

- How to modify the chat UI:
  1. Chat message components:
     - Main message component: `/web/pages/Chat/components/Message.tsx`
     - Message options: `MessageOptions` component within the same file
     - Message styling: `/web/pages/Settings/UISettings.tsx`
  2. Chat layout components:
     - Main chat layout: `/web/pages/Chat/ChatArea.tsx`
     - Chat options: `/web/pages/Chat/ChatOptions.tsx`
     - Chat menu: `/web/pages/Chat/ChatMenu.tsx`
  3. UI customization:
     - UI settings defined in `/web/store/ui.ts`
     - Settings applied in `/web/pages/Settings/UISettings.tsx`

- How to add database models:
  1. Define the schema:
     - Add the model interface to `/common/types/schema.ts` in the `AppSchema` namespace
  2. Create database operations:
     - Create a new file in `/srv/db/` for your model's operations
     - Follow patterns in existing files like `/srv/db/characters.ts`
     - Use MongoDB operations through the `db` function from `/srv/db/client.ts`
  3. Create API endpoints:
     - Add a new file in `/srv/api/` for your model's endpoints
     - Follow RESTful patterns for CRUD operations
     - Register the routes in `/srv/api/index.ts`
  4. Add frontend state management:
     - Create a store in `/web/store/` for your model
     - Follow patterns in existing stores like `/web/store/character.ts`

- State management patterns:
  1. Backend to frontend communication:
     - WebSocket events for real-time updates
     - HTTP API for CRUD operations
  2. Frontend stores:
     - Zustand store creation in `/web/store/create.ts`
     - Event-based communication between stores
     - Local storage synchronization for guest mode
  3. Component data flow:
     - Signal-based reactivity with SolidJS
     - Context providers for shared state
     - Props for component-specific data

- Testing patterns:
  1. Unit tests in `/tests/` directory
  2. Test utilities in `/tests/util.ts`
  3. Snapshot testing for deterministic outputs

- Adding new features:
  1. Identify the feature scope (frontend, backend, or both)
  2. Implement backend logic first if needed
  3. Create API endpoints for the feature
  4. Implement frontend components and state management
  5. Add to relevant UI navigation and menus
  6. Add tests to verify functionality

## Prompt Engineering
- Prompt System Architecture:
  - Core implementation: `/common/prompt.ts` - Contains the main prompt building logic
  - Template parsing: `/common/template-parser.ts` - Handles variable substitution in templates
  - Prompt parts assembly: `buildPromptParts()` and `createPromptParts()` functions
  - Chat formatting: `/common/chat.ts` - Structures conversations for the prompt

- Prompt Components:
  - Character persona: Basic character information and traits
  - Scenario: The setting and context of the conversation
  - Example chats: Sample dialogue demonstrating character's style 
  - Memory/Lore: Dynamic context provided based on conversation keywords
  - User-defined system prompts: Additional instructions for the AI
  - Chat history: Previous messages in the conversation

- Template Placeholders:
  - `{{char}}` - Character name
  - `{{user}}` - User name
  - `{{personality}}` - Character's persona
  - `{{scenario}}` - The current scenario
  - `{{sample}}` - Example dialogues
  - `{{memory}}` - Dynamic memory content
  - Many others defined in the template system

- Prompt Formats:
  - Different AI services require different prompt formats
  - Format definitions in `/common/adapters.ts` and individual adapter implementations
  - Support for chat-style APIs (OpenAI, Claude) and completion APIs

## Troubleshooting
- Common Issues:
  - MongoDB connection problems: Check connection string, ensure MongoDB is running
  - Pipeline API not working: Verify Python dependencies are installed properly
  - AI service errors: Check API keys and service settings
  - Image generation failures: Verify appropriate API keys and image settings

- Debugging Techniques:
  - Check server logs for errors: `LOG_LEVEL=debug npm run start`
  - Inspect WebSocket messages using browser developer tools
  - Use Redux DevTools to inspect application state
  - Add `console.log()` statements to frontend code for debugging
  - Check Network tab in browser dev tools for API request/response details

- Performance Issues:
  - Large chat history can slow down prompt generation
  - Memory book with too many entries can impact performance
  - Use Chrome performance profiling for frontend performance analysis

## Glossary
- Character: An AI personality that users can chat with
- Persona: The personality, traits, and information about a character
- Memory/Lore Book: A collection of information that can be dynamically included in prompts
- Preset: A saved configuration of generation settings
- Adapter: A connector to a specific AI service (OpenAI, Claude, etc.)
- Prompt Template: A structured format for sending instructions to the AI model
- Token: The basic unit of text that AI models process (roughly 4 characters)
- Context Window: The maximum amount of text an AI model can process at once
- OOC (Out of Character): Messages that aren't part of the roleplay narrative
- Generation Settings: Parameters that control how the AI generates text (temperature, etc.)
- Vector Embedding: Numerical representation of text for semantic search in long-term memory