# Implementation Plan: Website Modernization & Standardization

**Branch**: `001-modernize-website` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-modernize-website/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Standardize the codebase by eliminating three distinct development waves (inline styles, mixed Tailwind/global CSS, and modern Tailwind patterns) into a consistent, maintainable architecture. Transform 6 legacy route files to use modern Tailwind CSS patterns, decompose 2 large route files (800-1000+ lines) into modular components, unify typography system around theme-defined fonts, and establish enforced code standards. This is a refactoring effort focused on consistency and maintainability without changing functionality or visual design.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled), React 19, Node.js 22+
**Primary Dependencies**: React Router 7 (v7.9.0), Tailwind CSS 4, Vite 6, AWS Architect
**Storage**: Redis (ioredis) for server-side state, LocalStorage for client persistence, S3 for compiled MDX/images
**Testing**: Vitest for unit/integration tests, existing test coverage for ChesserGuesser features
**Target Platform**: AWS Lambda (Node.js 22.x runtime), CloudFront CDN, modern browsers (ES2022+)
**Project Type**: Web application (React Router SSR, single monorepo structure)
**Performance Goals**: Maintain current Lighthouse scores (90+ performance/accessibility), bundle size ≤ current baseline
**Constraints**: Zero breaking changes to public URLs, visual consistency maintained, all existing tests must pass
**Scale/Scope**: ~20 route files, 6 requiring inline style removal, 2 requiring decomposition (800-1000 lines), ~15 shared components to extract

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Minimalism & Simplicity ✅ PASS

**Evaluation**: This feature explicitly enforces minimalism by:
- Removing unnecessary inline styles (aligns with "nothing more, nothing less")
- Preferring editing existing files over creating new ones (refactoring, not new features)
- Enforcing 500-line file limit (directly supports modular design principle)
- NOT creating new documentation beyond required planning artifacts

**Justification**: Feature IS the enforcement mechanism for this principle. No violations.

### Principle II: Quality Over Speed ✅ PASS

**Evaluation**: Feature requirements mandate:
- FR-016: All refactored code MUST pass existing tests and type checking
- FR-017: Code standards documentation MUST be created (quality gates)
- FR-018: Linting rules MUST enforce consistent patterns
- Success criteria includes maintaining TypeScript compilation without errors

**Justification**: Feature strengthens quality gates. No violations.

### Principle III: Environment Safety ✅ PASS

**Evaluation**: Refactoring effort does not involve:
- Adding new secrets or API keys
- Modifying deployment configuration
- Creating files in root folder (all artifacts go to appropriate subdirectories)

**Compliance**:
- Specifications → `specs/001-modernize-website/`
- Refactored routes → existing `app/routes/`
- New shared components → existing `app/components/`
- Documentation → `docs/` if needed

**Justification**: No environment safety concerns. No violations.

### Principle IV: Test-First Development ✅ PASS

**Evaluation**:
- FR-016 requires all existing tests to pass
- SC-008 mandates visual regression tests
- Refactoring maintains test coverage
- Tests reside in `tests/` directory (compliant)

**Justification**: Feature preserves and validates existing test infrastructure. No violations.

### Principle V: Clean Architecture ✅ PASS

**Evaluation**: Feature ENFORCES clean architecture by:
- FR-006: Decomposing large files into focused components
- FR-007: Extracting shared UI patterns as reusable components
- FR-008: Moving complex logic to custom hooks
- Using established project structure (app/, tests/, docs/)

**Justification**: Feature IS the mechanism to achieve clean architecture. No violations.

### Development Standards ✅ PASS

**Technology Stack**: Feature maintains existing stack (React Router 7, TypeScript, Tailwind CSS 4, AWS Architect)

**File Organization**: All refactoring respects established structure:
- Source code → `app/`
- Tests → `tests/`
- Planning artifacts → `specs/001-modernize-website/`

**Build Verification**: FR-016 explicitly requires lint and typecheck to pass

**Justification**: Feature strengthens adherence to development standards. No violations.

### Deployment Standards ✅ PASS

**Evaluation**:
- No changes to CDN asset strategy
- No changes to Lambda optimization
- No changes to MDX compilation
- No changes to environment configuration

**Justification**: Deployment pipeline remains unchanged per "Out of Scope" section. No violations.

### 🟢 OVERALL: ALL GATES PASSED - Proceed to Phase 0

No violations requiring justification in Complexity Tracking table.

---

## Post-Phase 1 Constitution Re-Check

*Re-evaluating constitution compliance after completing design phase.*

### Principle I: Minimalism & Simplicity ✅ PASS

**Post-Design Evaluation**:
- Phase 1 generated minimal required artifacts (research.md, data-model.md, contracts/, quickstart.md)
- No unnecessary files created beyond planning requirements
- Contracts define standards without over-engineering
- Research resolved unknowns without creating excessive documentation

**Compliance**: Strengthened. Documentation is focused and purposeful.

### Principle II: Quality Over Speed ✅ PASS

**Post-Design Evaluation**:
- Code standards document (`contracts/code-standards.md`) establishes quality gates
- ESLint rules defined for automated enforcement
- Visual regression testing strategy documented
- TypeScript strict mode maintained

**Compliance**: Strengthened. Quality gates formalized.

### Principle III: Environment Safety ✅ PASS

**Post-Design Evaluation**:
- All planning artifacts created in `specs/001-modernize-website/` (proper structure)
- No changes to environment configuration
- No secrets or sensitive data in planning documents
- Agent context updated appropriately

**Compliance**: Maintained. No violations.

### Principle IV: Test-First Development ✅ PASS

**Post-Design Evaluation**:
- Visual regression testing strategy established (Playwright)
- Component testing patterns documented
- Test-before-refactor workflow defined
- Existing test coverage preservation mandated

**Compliance**: Strengthened. Testing strategy comprehensive.

### Principle V: Clean Architecture ✅ PASS

**Post-Design Evaluation**:
- Component decomposition patterns documented
- Shared component extraction strategy defined
- Custom hook patterns established
- File size limits enforced (500-line max)

**Compliance**: Strengthened. Architecture patterns formalized.

### Development Standards ✅ PASS

**Post-Design Evaluation**:
- Technology stack unchanged (React Router 7, TypeScript, Tailwind CSS 4)
- File organization respected in all planning artifacts
- Build verification mandated in code standards
- Agent context (CLAUDE.md) updated with new technology references

**Compliance**: Maintained. Standards adhered to.

### Deployment Standards ✅ PASS

**Post-Design Evaluation**:
- No changes to deployment pipeline proposed
- CDN, Lambda, and MDX compilation strategies unchanged
- Environment separation maintained

**Compliance**: Maintained. No violations.

### 🟢 POST-PHASE 1: ALL GATES PASSED

Constitution compliance **strengthened** after Phase 1 design. Quality gates formalized, testing strategy established, architecture patterns documented. No violations introduced.

**Ready for Phase 2: Task Generation** (`/speckit.tasks`)

## Project Structure

### Documentation (this feature)

```text
specs/001-modernize-website/
├── spec.md              # Feature specification (/speckit.specify command output)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── code-standards.md  # Approved patterns for components, styling, exports
├── checklists/
│   └── requirements.md  # Specification quality validation
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created yet)
```

### Source Code (repository root)

```text
tylerbarron-dot-com/
├── app/
│   ├── routes/          # Page-level components (refactor 6 legacy routes here)
│   │   ├── theRiddler.tsx          # Target: remove inline styles
│   │   ├── set.tsx                 # Target: remove inline styles
│   │   ├── SSBM.tsx                # Target: remove inline styles
│   │   ├── camelUpCup.tsx          # Target: remove inline styles
│   │   ├── generativeArt.tsx       # Target: remove inline styles
│   │   ├── boulderingTracker.tsx   # Target: remove inline styles
│   │   ├── chesserGuesser.tsx      # Target: decompose (811 lines)
│   │   ├── collaborativeCheckmate.$gameId.$playerId.tsx  # Target: decompose (1023 lines)
│   │   └── [other routes...]
│   │
│   ├── components/      # Shared UI components (extract patterns here)
│   │   ├── ChesserGuesser/         # Example of good decomposition
│   │   │   ├── ModeSwitcher.tsx
│   │   │   ├── UsernameModal.tsx
│   │   │   ├── DailyProgressTracker.tsx
│   │   │   └── Leaderboard.tsx
│   │   ├── Article.tsx             # Target: fix font inconsistencies
│   │   ├── Subarticle.tsx          # Target: standardize patterns
│   │   └── [new shared components] # Extract: PhotoGallery, Modal, etc.
│   │
│   ├── hooks/           # Custom hooks (extract complex logic here)
│   │   └── [new hooks]  # Extract game logic, image gallery, etc.
│   │
│   ├── styles/
│   │   └── index.css    # Target: reduce global CSS scope
│   │
│   └── types/           # TypeScript definitions
│
├── tests/               # Test files (maintain coverage)
│   ├── chess.spec.ts
│   └── [other tests...]
│
├── docs/                # Documentation (if needed)
│   └── code-standards.md  # Could mirror contracts/code-standards.md
│
└── specs/               # Planning artifacts
    └── 001-modernize-website/
```

**Structure Decision**: Single web application monorepo (existing structure). All refactoring occurs within established `app/` directory using React Router 7 file-based routing. No new top-level directories required. Shared components extracted to `app/components/`, hooks to `app/hooks/`, following existing conventions demonstrated by ChesserGuesser suite.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. Table intentionally left empty per constitution compliance.
