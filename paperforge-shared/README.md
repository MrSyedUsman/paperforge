# Shared PaperForge simulation formulas

Dependency-free ESM accounting functions with TypeScript declarations, consumed
through `file:../paperforge-shared` by the frontend and backend. Keep this folder
beside both apps when cloning, installing, building or packaging the project.
No separate installation or compilation is needed for this package.

The functions preserve the original simulator's arithmetic. Trading transitions
stay in their existing feature engines. Account/liquidation/competition regression
tests verify the existing behavior, and backend review tests use the same module.
