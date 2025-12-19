---
name: software-architecture
description: Senior Staff Engineer guidance for Clean Architecture, SOLID principles, and Domain-Driven Design. Use for refactoring or planning new modules.
---

# Software Architecture Skill

## Principles
- **Clean Architecture**: Separate Domain (business logic) from Infrastructure (DB, API, Frameworks).
- **Early Returns**: Use guard clauses to reduce nesting.
- **Service Layer**: Keep business logic (like tax calculations) in pure functions in \`src/lib/\`.
