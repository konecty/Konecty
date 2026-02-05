# System Patterns

## System architecture
- Modular Node.js backend with MongoDB as the primary database
- RESTful API exposing CRUD operations for all entities
- Authentication and RBAC as core middleware
- Extensible via modules and metadata configuration (JSON Schema)
- Event-driven and queue-based integrations supported
- Pluggable storage system (filesystem, S3, external server)
- Advanced filtering and list view configuration for flexible data access

## Key technical decisions
- Use of Node.js for asynchronous, scalable server logic
- MongoDB for flexible, document-oriented data modeling
- JSON Schema for dynamic document and list view definitions
- Pino for structured logging
- Zod for input validation
- All documentation and process records managed in English via the memory bank

## Design patterns in use
- Modular architecture for extensibility
- Middleware for cross-cutting concerns (auth, logging, validation)
- Repository pattern for data access
- Event-driven patterns for integrations and automations
- Dynamic filter builder for complex queries
- Resource abstraction for message queues and storage

## Component relationships
- Core modules: authentication, RBAC, CRUD, entity relationships, document schema, list views
- Extension modules: custom business logic, integrations, automations, event handlers
- Memory bank: central documentation and process knowledge
- Storage and event resources: pluggable and configurable for different environments 