# Feature Specification: Website Modernization & Standardization

**Feature Branch**: `001-modernize-website`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Lets make a plan to modernize the website. Right now it was built in a few waves using a few different protocols. I want it it to be standardized and done in the most up to date kind of way"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Standardized Styling Architecture (Priority: P1)

All pages and components use consistent Tailwind CSS patterns without inline styles or conflicting global CSS. Visitors experience uniform visual design and developers can maintain styles efficiently.

**Why this priority**: Foundation for all other modernization work. Inconsistent styling causes maintenance issues, design drift, and makes it difficult to implement new features consistently.

**Independent Test**: Can be fully tested by reviewing all route files and components for inline style usage, verifying Tailwind classes are used consistently, and validating that global CSS doesn't conflict with component styles. Delivers immediate value through easier maintenance and design consistency.

**Acceptance Scenarios**:

1. **Given** a visitor navigates to any page, **When** they view the page, **Then** all visual elements follow the same design system with consistent spacing, typography, and colors
2. **Given** a developer needs to update a component style, **When** they modify Tailwind classes, **Then** changes are predictable and don't conflict with global CSS or inline styles
3. **Given** a new feature is added, **When** developers create new components, **Then** they can reference clear examples using modern Tailwind patterns without encountering legacy inline style approaches

---

### User Story 2 - Modular Component Architecture (Priority: P2)

Large route files are decomposed into smaller, reusable components and custom hooks. Complex features are easier to understand, test, and maintain.

**Why this priority**: Improves code maintainability and enables better testing. Large files (800-1000+ lines) are difficult to understand and modify safely.

**Independent Test**: Can be fully tested by identifying route files over 500 lines, extracting shared logic to components/hooks, and verifying each extracted component works independently. Delivers value through improved developer velocity and fewer bugs.

**Acceptance Scenarios**:

1. **Given** a developer needs to fix a bug in a complex feature, **When** they navigate to the code, **Then** they can find the relevant logic in focused components under 300 lines each
2. **Given** similar functionality exists in multiple routes, **When** developers need to update behavior, **Then** they modify a single shared component rather than updating multiple files
3. **Given** a new developer joins the project, **When** they review the codebase, **Then** they can understand component responsibilities without tracing through thousand-line files

---

### User Story 3 - Unified Font & Typography System (Priority: P3)

All text content uses the standardized font system defined in the Tailwind theme. Typography is consistent across all pages.

**Why this priority**: Ensures professional appearance and brand consistency. Multiple competing font systems create visual inconsistency and confusion.

**Independent Test**: Can be fully tested by auditing all components for hardcoded font families, verifying only theme fonts are used (`font-neo`, `font-mono`), and checking that typography renders consistently. Delivers value through cohesive brand presentation.

**Acceptance Scenarios**:

1. **Given** a visitor reads content across different pages, **When** they view text elements, **Then** all body text uses the same font family and all code uses the monospace font
2. **Given** a developer creates a new component, **When** they apply text styling, **Then** they use theme-based font classes without hardcoding font families
3. **Given** the design requires a font change, **When** the theme is updated, **Then** all text across the site reflects the new font without individual component changes

---

### User Story 4 - Consistent Code Patterns & Export Conventions (Priority: P4)

All components follow the same structural patterns, export conventions, and TypeScript typing approach. Codebase has a unified "voice."

**Why this priority**: Reduces cognitive load when switching between files. Consistency makes code reviews easier and reduces bugs from pattern confusion.

**Independent Test**: Can be fully tested by establishing coding standards, auditing components for compliance, and verifying all new components follow the patterns. Delivers value through faster code comprehension.

**Acceptance Scenarios**:

1. **Given** a developer reviews code, **When** they open any component file, **Then** they see consistent patterns for exports, prop types, and component structure
2. **Given** automated linting is configured, **When** code is committed, **Then** the linter enforces consistent patterns across the codebase
3. **Given** documentation exists for code standards, **When** developers reference it, **Then** they find clear examples of preferred patterns for all common scenarios

---

### Edge Cases

- What happens when existing pages have deeply nested inline styles that conflict with Tailwind utilities?
- How does the system handle third-party components that use their own styling approaches?
- What if global CSS removal breaks existing visual layouts that depended on element-level defaults?
- How are route files with 1000+ lines refactored without breaking existing functionality?
- What happens to legacy route URL patterns during modernization?

## Requirements *(mandatory)*

### Functional Requirements

#### Styling & Design System

- **FR-001**: All route components MUST use Tailwind CSS classes for styling without inline `style={}` objects
- **FR-002**: Global CSS MUST NOT apply opinionated styles to base HTML elements (p, h1-h6, button, input, table) that limit component flexibility
- **FR-003**: All typography MUST use theme-defined font families (`font-neo` for body, `font-mono` for code) without hardcoded font-family declarations
- **FR-004**: Component styles MUST be scoped using Tailwind classes rather than relying on global element selectors
- **FR-005**: Dark mode support MUST be consistently implemented across all pages using theme-based color tokens

#### Component Architecture

- **FR-006**: Route files SHOULD be under 500 lines; complex features MUST be decomposed into smaller components
- **FR-007**: Shared UI patterns (photo galleries, article layouts, modals) MUST be extracted as reusable components
- **FR-008**: Complex component logic MUST be extracted to custom hooks for reusability and testing
- **FR-009**: All components MUST have TypeScript interfaces defining their props
- **FR-010**: Components MUST use consistent export patterns (default vs named) as defined by project standards

#### Code Consistency

- **FR-011**: All functional components MUST follow the same structural pattern (props destructuring, hooks, render logic)
- **FR-012**: Route file naming MUST follow consistent convention (camelCase for files, kebab-case for URLs)
- **FR-013**: State management patterns MUST be consistent (useState for local state, localStorage patterns for persistence)
- **FR-014**: Similar features MUST use the same architectural patterns (e.g., all game pages use similar state management)

#### Quality & Standards

- **FR-015**: Modernized components MUST maintain existing functionality without breaking changes
- **FR-016**: All refactored code MUST pass existing tests and type checking
- **FR-017**: Code standards documentation MUST be created defining approved patterns for components, styling, and architecture
- **FR-018**: Linting rules MUST enforce consistent code patterns automatically

### Key Entities

- **Route Component**: Page-level component representing a URL path; should follow consistent patterns, use Tailwind styling, export types, and decompose complex logic
- **Shared Component**: Reusable UI component used across multiple routes; must be documented, typed, and follow design system patterns
- **Custom Hook**: Extracted logic for reusable stateful behavior; manages component lifecycle, side effects, or shared state
- **Style Pattern**: Approved Tailwind class combination for common UI elements; documented in design system, enforced through linting
- **Code Standard**: Documented convention for component structure, exports, naming, and patterns; enforced through linting and code review

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero route or component files contain inline `style={}` objects
- **SC-002**: All route files are under 500 lines, with no single file exceeding this threshold
- **SC-003**: 100% of text elements use theme-defined fonts (`font-neo` or `font-mono`) without hardcoded font families
- **SC-004**: All shared UI patterns (photo galleries, article layouts) exist as standalone components used by at least 2+ routes
- **SC-005**: Code review time for new features decreases by 40% due to consistent patterns
- **SC-006**: Developer onboarding time improves, with new contributors able to add features within their first week
- **SC-007**: All TypeScript compilation passes without errors related to missing type definitions
- **SC-008**: Visual regression tests pass, confirming no unintended visual changes during modernization
- **SC-009**: Lighthouse accessibility and performance scores maintain or improve during refactoring
- **SC-010**: Documentation exists covering code standards, component patterns, and design system usage

## Dependencies & Assumptions *(mandatory)*

### Dependencies

- Existing test coverage must be maintained to verify functionality during refactoring
- Tailwind CSS 4 theme configuration is already defined and should serve as the single source of truth
- Modern build tooling (Vite 6, React Router 7) is already in place
- Development environment supports hot module reloading for rapid iteration

### Assumptions

- Current functionality must be preserved; this is a refactoring effort, not a feature change
- Visual appearance should remain consistent unless explicitly improved
- Breaking changes to public URLs are not acceptable; route structure should be maintained
- The modern ChesserGuesser components represent the target architecture and patterns
- Existing production deployment pipeline remains unchanged
- All changes must be backward compatible with existing content (blog posts, static assets)
- Team has capacity to review and test changes incrementally rather than a big-bang release

## Out of Scope *(mandatory)*

- Adding new features or functionality beyond standardization
- Changing the visual design or brand identity
- Migrating to different frameworks or libraries
- Restructuring the deployment pipeline or infrastructure
- Updating third-party dependencies unless required for standardization
- Implementing new state management libraries (Redux, Zustand) - local state patterns are sufficient
- Adding new testing frameworks or dramatically increasing test coverage
- SEO improvements or content strategy changes
- Accessibility improvements beyond maintaining current levels
- Performance optimization beyond maintaining current metrics

## Technical Context *(optional)*

### Current State Analysis

The codebase shows evidence of three distinct development phases:

**Wave 1 (Legacy)**: Inline styles with `style={}` objects
- Files: theRiddler.tsx, set.tsx, SSBM.tsx, camelUpCup.tsx, generativeArt.tsx, boulderingTracker.tsx
- Pattern: Hardcoded CSS objects, no responsive design
- Issue: Inconsistent with modern approach, hard to maintain

**Wave 2 (Transition)**: Mixed Tailwind + Global CSS
- Files: Article.tsx, Subarticle.tsx
- Pattern: Tailwind classes but referencing non-theme fonts, heavy global CSS
- Issue: Conflicts between component styles and global element selectors

**Wave 3 (Modern)**: Clean Tailwind 4 + Component Architecture
- Files: ChesserGuesser suite (ModeSwitcher, UsernameModal, DailyProgressTracker, Leaderboard)
- Pattern: Theme-based Tailwind, proper component decomposition, TypeScript interfaces
- This represents the target state for modernization

### Font System Confusion

Three competing systems currently exist:
1. `font-neo` (Inter) - theme-defined, should be standard
2. Hardcoded `font-family: 'Inter'` in global CSS
3. `font-mono` (JetBrains Mono) - theme-defined for code
4. Berkeley font for special cases

Modernization should standardize on theme-based fonts only.

### Global CSS Issues

Current `index.css` applies heavy styling to base elements:
```css
p { @apply pl-4 pr-4 mx-auto leading-relaxed my-6; }
```

This creates conflicts when components try to override spacing/alignment. Global CSS should be reduced to truly global concerns (CSS reset, theme variables) rather than opinionated element styling.

### Component Size Problem

Some route files exceed reasonable size limits:
- `collaborativeCheckmate.$gameId.$playerId.tsx`: 1023 lines
- `chesserGuesser.tsx`: 811 lines

These should be decomposed into:
- Page component (routing, data loading)
- Feature components (game board, controls)
- Shared components (modals, buttons)
- Custom hooks (game logic, state management)

### Routing Architecture

The `routes.ts` file maintains backward compatibility with three URL conventions:
- Modern kebab-case (preferred): `chesser-guesser`
- Legacy camelCase: `chesserGuesser`
- Legacy PascalCase: `ChesserGuesser`

Modernization should maintain URL compatibility while standardizing file naming.
