# Research: Website Modernization & Standardization

**Feature**: 001-modernize-website | **Date**: 2025-12-30

## Overview

This document consolidates research findings for modernizing the website codebase from three inconsistent development waves into a unified, maintainable architecture. All technical unknowns from the planning phase have been resolved through analysis of the existing codebase and industry best practices.

## Research Tasks Completed

### 1. Inline Style Migration Strategy

**Question**: What's the best approach to migrate inline `style={}` objects to Tailwind classes without breaking visual layouts?

**Decision**: Incremental route-by-route migration with visual regression testing

**Rationale**:
- Each of the 6 legacy routes (theRiddler, set, SSBM, camelUpCup, generativeArt, boulderingTracker) can be migrated independently
- Inline styles represent deterministic layouts that can be directly mapped to Tailwind utilities
- Visual regression testing (SC-008) catches unintended changes
- Modern ChesserGuesser components provide reference implementation for patterns

**Alternatives Considered**:
1. **Big-bang migration** - Rejected: High risk, difficult to test incrementally, violates constitution's minimalism principle
2. **CSS-in-JS migration first** - Rejected: Adds complexity, not aligned with Tailwind-first approach
3. **Gradual coexistence** - Rejected: Perpetuates technical debt, doesn't achieve standardization goal

**Implementation Pattern**:
```typescript
// BEFORE (inline styles)
<div style={{
  cursor: 'pointer',
  margin: '20px auto',
  textAlign: 'center',
  maxWidth: '80%'
}}>

// AFTER (Tailwind classes)
<div className="cursor-pointer mx-auto my-5 text-center max-w-[80%]">
```

**Testing Strategy**: Compare screenshots before/after for each route using Playwright visual regression or similar tool

---

### 2. Global CSS Reduction Strategy

**Question**: How to safely reduce global CSS element styling without breaking existing layouts?

**Decision**: Scope-based CSS reduction with component-level defaults

**Rationale**:
- Current `index.css` applies heavy styling to base elements (`p`, `h1-h6`, `button`, etc.)
- These global styles prevent component flexibility and create specificity conflicts
- Tailwind's reset provides better baseline with component-scoped overrides
- Constitution Principle V requires clean separation of concerns

**Alternatives Considered**:
1. **Keep global CSS, namespace Tailwind** - Rejected: Perpetuates conflicts, doesn't solve root cause
2. **Remove all global CSS immediately** - Rejected: High risk of visual breakage across site
3. **CSS Modules migration** - Rejected: Not aligned with Tailwind-first approach, adds build complexity

**Migration Approach**:
1. Audit global CSS usage across all routes (`app/styles/index.css`)
2. Identify which element styles are truly global (reset, theme variables) vs component-specific
3. Move component-specific defaults to base layer utilities:
   ```css
   @layer base {
     /* Keep only truly global resets */
     *, ::before, ::after { box-sizing: border-box; }
   }

   @layer components {
     /* Component-specific defaults as utilities */
     .prose p { @apply pl-4 pr-4 mx-auto leading-relaxed my-6; }
   }
   ```
4. Update components to use `.prose` wrapper where needed
5. Remove opinionated element selectors from global scope

**Risk Mitigation**: Visual regression testing, incremental rollout per route

---

### 3. Component Decomposition Patterns

**Question**: What's the best way to decompose large route files (800-1000+ lines) without breaking functionality?

**Decision**: Feature-based component extraction with custom hooks for logic

**Rationale**:
- ChesserGuesser suite demonstrates successful pattern: page component + feature components + custom hooks
- Aligns with Constitution Principle I (500-line file limit) and Principle V (clean architecture)
- React Router 7 supports nested routes but route files should remain focused on routing/data loading
- Complex logic extracted to hooks improves testability

**Target Files**:
1. `chesserGuesser.tsx` (811 lines) → extract game UI, leaderboard, mode switching
2. `collaborativeCheckmate.$gameId.$playerId.tsx` (1023 lines) → extract game board, player controls, state management

**Decomposition Pattern** (based on ChesserGuesser):
```text
Route File (< 150 lines):
- Route exports (loader, action, default component)
- Data fetching logic
- Route-level error boundaries
- Minimal JSX (compose feature components)

Feature Components (< 300 lines each):
- GameBoard.tsx - chess board rendering
- GameControls.tsx - move input, buttons
- PlayerStatus.tsx - player info, timer

Custom Hooks (< 200 lines each):
- useGameState.ts - game logic, state management
- useWebSocket.ts - real-time updates
- useLocalStorage.ts - persistence patterns
```

**Alternatives Considered**:
1. **Keep large files, add comments** - Rejected: Doesn't solve maintainability, violates constitution
2. **Split by arbitrary line count** - Rejected: Breaks logical cohesion
3. **Create new page routes** - Rejected: Changes URL structure, violates constraint

**Testing Strategy**: Maintain existing test coverage, add component-level tests for extracted components

---

### 4. Typography Standardization

**Question**: How to standardize competing font systems without visual disruption?

**Decision**: Enforce theme-based font utilities, audit for hardcoded fonts

**Rationale**:
- Tailwind CSS 4 theme defines `font-neo` (Inter) and `font-mono` (JetBrains Mono)
- Global CSS has conflicting `font-family: 'Inter'` declarations
- Some components reference `font-mono` incorrectly in body text contexts
- Constitution mandates consistency through linting (FR-018)

**Current Font Systems** (from spec Technical Context):
1. `font-neo` (Inter) - theme-defined, **should be standard for body text**
2. `font-mono` (JetBrains Mono) - theme-defined, **should be for code blocks only**
3. Hardcoded `font-family: 'Inter'` in global CSS - **remove**
4. Berkeley font for special cases - **evaluate usage, likely remove or standardize**

**Migration Strategy**:
1. **Audit Phase**: Search codebase for:
   - `font-family:` in style attributes
   - `font-family` in CSS files
   - Incorrect `font-mono` usage (should only appear in code/pre elements)
2. **Replace Phase**:
   - Body text → `font-neo` or no class (if default)
   - Code blocks → `font-mono`
   - Remove all hardcoded `font-family` declarations
3. **Validation Phase**:
   - ESLint rule: Disallow `font-family` in style objects
   - Visual regression: Ensure typography renders identically
   - Documentation: Update code standards with approved font classes

**Alternatives Considered**:
1. **Keep multiple font systems** - Rejected: Perpetuates inconsistency, violates standardization goal
2. **Migrate to different font** - Rejected: Changes visual design, out of scope
3. **Use CSS variables for fonts** - Rejected: Tailwind theme already provides this abstraction

**ESLint Rule Example**:
```json
{
  "rules": {
    "react/forbid-dom-props": ["error", {
      "forbid": [{"propName": "style", "message": "Use Tailwind classes instead"}]
    }]
  }
}
```

---

### 5. Code Pattern Enforcement

**Question**: What linting and tooling is needed to enforce consistent patterns automatically?

**Decision**: Extend existing ESLint config with custom rules for pattern enforcement

**Rationale**:
- Constitution Principle II mandates "ESLint MUST pass before commits"
- FR-018 requires "Linting rules MUST enforce consistent code patterns"
- Existing `.eslintrc` provides foundation, needs modernization-specific rules
- Prettier already configured for formatting

**Rules to Add**:

1. **Forbid inline styles**:
   ```json
   "react/forbid-dom-props": ["error", {
     "forbid": [{
       "propName": "style",
       "message": "Use Tailwind utility classes instead of inline styles"
     }]
   }]
   ```

2. **Enforce consistent exports**:
   ```json
   "import/no-default-export": "off",  // Allow for route files
   "import/prefer-default-export": ["error", {
     "target": "any"
   }]
   ```

3. **Enforce file size limits**:
   ```json
   "max-lines": ["warn", {
     "max": 500,
     "skipBlankLines": true,
     "skipComments": true
   }]
   ```

4. **TypeScript strict mode (already configured)**:
   ```json
   "@typescript-eslint/strict-boolean-expressions": "error",
   "@typescript-eslint/no-explicit-any": "error"
   ```

**Alternatives Considered**:
1. **Custom AST linter** - Rejected: Over-engineering, ESLint sufficient
2. **Pre-commit hooks only** - Rejected: Feedback loop too late, prefer IDE integration
3. **No linting enforcement** - Rejected: Violates constitution, doesn't achieve SC-010

**Tooling Integration**:
- VS Code: ESLint extension provides real-time feedback
- Pre-commit: Husky + lint-staged (if not already configured)
- CI/CD: Already runs `npm run lint` (per CLAUDE.md)

---

### 6. Shared Component Extraction

**Question**: Which UI patterns should be extracted as shared components?

**Decision**: Extract components used in 2+ routes, following ChesserGuesser pattern

**Rationale**:
- FR-007: "Shared UI patterns MUST be extracted as reusable components"
- SC-004: "All shared UI patterns exist as standalone components used by at least 2+ routes"
- Reduces duplication, improves consistency, aligns with DRY principle

**Components to Extract** (based on codebase analysis):

1. **PhotoGallery** - Currently duplicated across multiple routes
   - Used in: generativeArt, boulderingTracker, possibly others
   - Props: `images: string[], layout?: 'grid' | 'masonry', lightbox?: boolean`
   - Dependencies: `yet-another-react-lightbox` (already installed)

2. **ArticleLayout** - Shared structure for blog/content pages
   - Used in: Article.tsx pattern repeated in multiple routes
   - Props: `title, subtitle, children, styleModifier?`
   - Standardizes content page structure

3. **Modal** - Generic modal wrapper
   - Used in: ChesserGuesser (UsernameModal), likely other routes
   - Props: `isOpen, onClose, title?, children`
   - Provides consistent modal UX

4. **Button** - Standardized button component
   - Currently inconsistent styling across routes
   - Props: `variant: 'primary' | 'secondary' | 'danger', size?, disabled?, onClick`
   - Enforces design system

5. **Card** - Content card with border/shadow
   - Pattern repeated across multiple routes
   - Props: `children, className?, onClick?`
   - Matches existing `bg-white border-4 border-black` pattern

**Extraction Pattern**:
```typescript
// app/components/PhotoGallery.tsx
interface PhotoGalleryProps {
  images: string[];
  layout?: 'grid' | 'masonry';
  lightbox?: boolean;
}

export default function PhotoGallery({ images, layout = 'grid', lightbox = true }: PhotoGalleryProps) {
  // Implementation using yet-another-react-lightbox
}
```

**Alternatives Considered**:
1. **Create design system library** - Rejected: Over-engineering for ~5 components
2. **Keep duplication** - Rejected: Violates DRY, doesn't achieve standardization
3. **Use third-party component library** - Rejected: Adds dependency, existing patterns work well

**Testing Strategy**: Create component tests for each extracted component, verify usage in all routes

---

### 7. Visual Regression Testing Setup

**Question**: How to validate that refactoring doesn't break visual layouts?

**Decision**: Use Playwright for screenshot-based visual regression testing

**Rationale**:
- SC-008: "Visual regression tests pass, confirming no unintended visual changes"
- Playwright already common in React/Vite ecosystem
- Can run in CI/CD pipeline
- Supports multi-browser testing

**Setup Approach**:
1. **Install Playwright**: `npm install -D @playwright/test`
2. **Configure visual testing**:
   ```typescript
   // tests/visual/routes.spec.ts
   test('theRiddler route renders correctly', async ({ page }) => {
     await page.goto('/theRiddler');
     await expect(page).toHaveScreenshot('theRiddler.png');
   });
   ```
3. **Baseline creation**: Run tests before refactoring to establish baseline screenshots
4. **Validation**: Re-run after each route refactor, fail if pixel differences exceed threshold
5. **Update baselines**: When intentional changes made, update baseline images

**Alternatives Considered**:
1. **Percy/Chromatic** - Rejected: Adds external service dependency, cost
2. **Manual QA** - Rejected: Not scalable, violates SC-008 requirement
3. **Jest snapshot testing** - Rejected: HTML snapshots don't catch visual regressions

**CI Integration**:
```yaml
# .github/workflows/ci.yml (if using GitHub Actions)
- name: Run visual regression tests
  run: npm run test:visual
- uses: actions/upload-artifact@v3
  if: failure()
  with:
    name: visual-diff
    path: test-results/
```

---

### 8. Incremental Rollout Strategy

**Question**: How to refactor incrementally without disrupting development?

**Decision**: Feature flag approach with route-by-route migration

**Rationale**:
- Constitution Assumption: "Team has capacity to review and test changes incrementally"
- Large codebase requires phased approach to minimize risk
- Allows testing each change in isolation
- Enables rollback if issues discovered

**Rollout Phases**:

**Phase 1: Foundation** (Week 1-2)
- Set up visual regression testing baseline
- Create shared components (PhotoGallery, Modal, Button, Card, ArticleLayout)
- Update ESLint config with new rules
- Document code standards in `contracts/code-standards.md`

**Phase 2: Low-Risk Routes** (Week 3-4)
- Refactor 3 simpler legacy routes (theRiddler, set, SSBM)
- Validate visual regression tests pass
- Gather feedback on new patterns

**Phase 3: Complex Routes** (Week 5-6)
- Refactor remaining legacy routes (camelUpCup, generativeArt, boulderingTracker)
- Fix font inconsistencies in Article/Subarticle
- Reduce global CSS scope

**Phase 4: Large File Decomposition** (Week 7-8)
- Decompose chesserGuesser.tsx (811 lines)
- Decompose collaborativeCheckmate.$gameId.$playerId.tsx (1023 lines)
- Extract custom hooks

**Phase 5: Global Cleanup** (Week 9-10)
- Final global CSS reduction
- Enforce all ESLint rules
- Update documentation
- Run full regression test suite

**Rollback Strategy**:
- Each phase committed separately
- Git tags for each phase completion
- Feature flags if needed (though not expected for refactoring)

**Alternatives Considered**:
1. **Big-bang deployment** - Rejected: High risk, difficult to debug issues
2. **Parallel codebase** - Rejected: Maintenance overhead, merge conflicts
3. **Feature branches per route** - Rejected: Too many branches, integration complexity

---

## Technology Decisions Summary

| Decision Area | Choice | Rationale |
|--------------|--------|-----------|
| **Inline Style Migration** | Incremental route-by-route with Tailwind mapping | Safe, testable, preserves visual consistency |
| **Global CSS Strategy** | Scope reduction with component utilities | Reduces conflicts, maintains flexibility |
| **Component Decomposition** | Feature-based extraction with custom hooks | Follows proven ChesserGuesser pattern |
| **Typography System** | Theme-based fonts only (`font-neo`, `font-mono`) | Enforces consistency, eliminates conflicts |
| **Pattern Enforcement** | ESLint custom rules + pre-commit hooks | Automated, catches issues early |
| **Shared Components** | Extract 5 core components (Gallery, Modal, Button, Card, Article) | Reduces duplication, enforces design system |
| **Visual Testing** | Playwright screenshot-based regression | Industry standard, CI-friendly |
| **Rollout Strategy** | 5-phase incremental migration | Minimizes risk, enables validation |

## Dependencies & Tools

**Existing** (already in package.json):
- React Router 7 (v7.9.0)
- Tailwind CSS 4
- TypeScript 5.x
- Vite 6
- Vitest
- ESLint + Prettier
- yet-another-react-lightbox

**New** (to be installed):
- `@playwright/test` - Visual regression testing
- ESLint plugins (if needed for custom rules)

**No breaking changes to existing dependencies required.**

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Visual regressions during refactor | Medium | High | Playwright visual testing, incremental rollout |
| Breaking existing tests | Low | High | Maintain test coverage, run tests after each change |
| Performance degradation | Low | Medium | Bundle size monitoring, Lighthouse audits |
| Developer resistance to patterns | Low | Low | Clear documentation, reference implementations |
| Scope creep beyond standardization | Medium | Medium | Strict adherence to "Out of Scope" in spec |

## Open Questions

**None.** All technical decisions have been made based on:
1. Existing codebase analysis (from spec Technical Context)
2. Constitution principles
3. Industry best practices for React/TypeScript/Tailwind
4. Proven patterns from ChesserGuesser suite

## Next Steps

Proceed to **Phase 1: Design & Contracts**:
1. Create `data-model.md` (minimal - this is refactoring, not data modeling)
2. Generate `contracts/code-standards.md` with approved patterns
3. Create `quickstart.md` for developer onboarding
4. Update agent context with new tooling decisions

**Phase 0 Research Complete** ✅
