---
description: "Task list for website modernization feature"
---

# Tasks: Website Modernization & Standardization

**Input**: Design documents from `/specs/001-modernize-website/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/code-standards.md

**Tests**: Visual regression tests are included as part of this refactoring effort to ensure no visual breakage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Repository root**: `/Users/trb/Documents/Github/tyler-barron-dot-com/tylerbarron-dot-com/`
- **Source code**: `app/`
- **Routes**: `app/routes/`
- **Components**: `app/components/`
- **Hooks**: `app/hooks/`
- **Styles**: `app/styles/`
- **Tests**: `tests/`
- **Visual tests**: `tests/visual/`
- **Docs**: `docs/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling setup for modernization effort

- [x] T001 Install Playwright for visual regression testing: `npm install -D @playwright/test`
- [x] T002 [P] Install Playwright browsers: `npx playwright install`
- [x] T003 [P] Create visual test directory structure: `mkdir -p tests/visual`
- [x] T004 [P] Configure Playwright in `playwright.config.ts` with screenshot settings
- [x] T005 [P] Create baseline visual test setup script in `tests/visual/setup.spec.ts`
- [x] T006 [P] Update ESLint config in `.eslintrc.cjs` with modernization rules (forbid inline styles, file size limits)
- [x] T007 [P] Add npm scripts to `package.json`: `test:visual`, `test:visual:baseline`, `test:visual:update`
- [x] T008 Create code standards documentation in `docs/code-standards.md` (copy from `specs/001-modernize-website/contracts/code-standards.md`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core shared components and infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 [P] Create PhotoGallery shared component in `app/components/PhotoGallery.tsx` with TypeScript interface
- [x] T010 [P] Create Modal shared component in `app/components/Modal.tsx` with TypeScript interface
- [x] T011 [P] Create Button shared component in `app/components/Button.tsx` with TypeScript interface
- [x] T012 [P] Create Card shared component in `app/components/Card.tsx` with TypeScript interface
- [x] T013 [P] Create ArticleLayout shared component in `app/components/ArticleLayout.tsx` with TypeScript interface
- [x] T014 [P] Create useLocalStorage custom hook in `app/hooks/useLocalStorage.ts`
- [x] T015 [P] Create useLightbox custom hook in `app/hooks/useLightbox.ts`
- [X] T016 Create baseline screenshots for all routes: run `npm run test:visual:baseline`
- [X] T017 Verify all baseline screenshots captured successfully in `tests/visual/__screenshots__/`

**Checkpoint**: Foundation ready - shared components created, visual baseline established. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Standardized Styling Architecture (Priority: P1) 🎯 MVP

**Goal**: Eliminate inline styles from all routes and components, establish Tailwind-only styling patterns, reduce global CSS scope

**Independent Test**: Review all route files for inline `style={}` usage (should be zero), verify Tailwind classes used consistently, validate global CSS doesn't conflict with component styles

### Visual Regression Tests for User Story 1

> **NOTE: Create tests FIRST, capture baselines, then refactor routes**

- [x] T018 [P] [US1] Create visual test for theRiddler route in `tests/visual/theRiddler.spec.ts`
- [x] T019 [P] [US1] Create visual test for set route in `tests/visual/set.spec.ts`
- [x] T020 [P] [US1] Create visual test for SSBM route in `tests/visual/SSBM.spec.ts`
- [x] T021 [P] [US1] Create visual test for camelUpCup route in `tests/visual/camelUpCup.spec.ts`
- [x] T022 [P] [US1] Create visual test for generativeArt route in `tests/visual/generativeArt.spec.ts`
- [x] T023 [P] [US1] Create visual test for boulderingTracker route in `tests/visual/boulderingTracker.spec.ts`

### Implementation for User Story 1

**Sub-Phase 3a: Legacy Routes - Inline Style Removal**

- [x] T024 [P] [US1] Refactor theRiddler route in `app/routes/theRiddler.tsx`: replace all inline styles with Tailwind classes
- [x] T025 [P] [US1] Refactor set route in `app/routes/set.tsx`: replace all inline styles with Tailwind classes
- [x] T026 [P] [US1] Refactor SSBM route in `app/routes/SSBM.tsx`: replace all inline styles with Tailwind classes
- [x] T027 [P] [US1] Refactor camelUpCup route in `app/routes/camelUpCup.tsx`: replace all inline styles with Tailwind classes
- [x] T028 [P] [US1] Refactor generativeArt route in `app/routes/generativeArt.tsx`: replace all inline styles with Tailwind classes, integrate PhotoGallery component
- [x] T029 [P] [US1] Refactor boulderingTracker route in `app/routes/boulderingTracker.tsx`: replace all inline styles with Tailwind classes, integrate PhotoGallery component

**Sub-Phase 3b: Global CSS Reduction**

- [x] T030 [US1] Audit global CSS in `app/styles/index.css`: identify element selectors to remove
- [x] T031 [US1] Create `.prose` wrapper utility classes in `app/styles/index.css` for content-specific styles
- [x] T032 [US1] Remove opinionated element selectors from `app/styles/index.css` (p, h1-h6, button, input, table)
- [x] T033 [US1] Update Article component in `app/components/Article.tsx` to use `.prose` wrapper where needed
- [x] T034 [US1] Update Subarticle component in `app/components/Subarticle.tsx` to use `.prose` wrapper where needed

**Sub-Phase 3c: Validation**

- [X] T035 [US1] Run visual regression tests for all refactored routes: `npm run test:visual`
- [X] T036 [US1] Run TypeScript type checking: `npm run typecheck`
- [X] T037 [US1] Run ESLint validation: `npm run lint`
- [X] T038 [US1] Manual testing: verify all 6 legacy routes render correctly in browser
- [X] T039 [US1] Verify zero inline `style={}` objects remain in codebase: `grep -r "style={{" app/routes/`

**Checkpoint**: At this point, User Story 1 should be fully functional - all routes use Tailwind-only styling, global CSS reduced, visual regression tests pass

---

## Phase 4: User Story 2 - Modular Component Architecture (Priority: P2)

**Goal**: Decompose large route files (800-1000+ lines) into focused components under 300 lines, extract complex logic to custom hooks

**Independent Test**: Verify route files are under 500 lines, extracted components work independently, complex logic moved to hooks

### Visual Regression Tests for User Story 2

- [ ] T040 [P] [US2] Create visual test for chesserGuesser route in `tests/visual/chesserGuesser.spec.ts`
- [ ] T041 [P] [US2] Create visual test for collaborativeCheckmate route in `tests/visual/collaborativeCheckmate.spec.ts`

### Implementation for User Story 2

**Sub-Phase 4a: ChesserGuesser Decomposition (811 lines → <500 lines)**

- [ ] T042 [US2] Extract game board UI from `app/routes/chesserGuesser.tsx` to `app/components/ChesserGuesser/GameBoard.tsx`
- [ ] T043 [US2] Extract move controls from `app/routes/chesserGuesser.tsx` to `app/components/ChesserGuesser/MoveControls.tsx`
- [ ] T044 [US2] Extract scoring display from `app/routes/chesserGuesser.tsx` to `app/components/ChesserGuesser/ScoreDisplay.tsx`
- [ ] T045 [US2] Create useChessGame custom hook in `app/hooks/useChessGame.ts` for game logic
- [ ] T046 [US2] Refactor `app/routes/chesserGuesser.tsx` to use extracted components and hooks (target: <200 lines)

**Sub-Phase 4b: CollaborativeCheckmate Decomposition (1023 lines → <500 lines)**

- [ ] T047 [US2] Extract chess board rendering from `app/routes/collaborativeCheckmate.$gameId.$playerId.tsx` to `app/components/CollaborativeCheckmate/ChessBoard.tsx`
- [ ] T048 [US2] Extract player controls from `app/routes/collaborativeCheckmate.$gameId.$playerId.tsx` to `app/components/CollaborativeCheckmate/PlayerControls.tsx`
- [ ] T049 [US2] Extract player status display from `app/routes/collaborativeCheckmate.$gameId.$playerId.tsx` to `app/components/CollaborativeCheckmate/PlayerStatus.tsx`
- [ ] T050 [US2] Create useGameState custom hook in `app/hooks/useGameState.ts` for collaborative game state management
- [ ] T051 [US2] Create useWebSocket custom hook in `app/hooks/useWebSocket.ts` for real-time updates
- [ ] T052 [US2] Refactor `app/routes/collaborativeCheckmate.$gameId.$playerId.tsx` to use extracted components and hooks (target: <200 lines)

**Sub-Phase 4c: Shared Pattern Extraction**

- [ ] T053 [P] [US2] Identify repeated image gallery patterns across routes, refactor to use PhotoGallery component
- [ ] T054 [P] [US2] Identify repeated modal patterns, refactor to use Modal component
- [ ] T055 [P] [US2] Identify repeated button patterns, refactor to use Button component

**Sub-Phase 4d: Validation**

- [ ] T056 [US2] Run visual regression tests for decomposed routes: `npm run test:visual`
- [ ] T057 [US2] Verify all route files are under 500 lines: `find app/routes -name "*.tsx" -exec wc -l {} \;`
- [ ] T058 [US2] Run TypeScript type checking: `npm run typecheck`
- [ ] T059 [US2] Run ESLint validation: `npm run lint`
- [ ] T060 [US2] Manual testing: verify ChesserGuesser and CollaborativeCheckmate functionality intact

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - no inline styles, all routes under 500 lines

---

## Phase 5: User Story 3 - Unified Font & Typography System (Priority: P3)

**Goal**: Standardize all text to use theme-defined fonts (`font-neo`, `font-mono`), eliminate hardcoded font-family declarations

**Independent Test**: Audit all components for hardcoded fonts (should be zero), verify only theme fonts used, check typography renders consistently

### Implementation for User Story 3

**Sub-Phase 5a: Font Usage Audit**

- [ ] T061 [US3] Search for hardcoded `fontFamily` in style attributes: `grep -r "fontFamily" app/`
- [ ] T062 [US3] Search for hardcoded `font-family` in CSS files: `grep -r "font-family" app/styles/`
- [ ] T063 [US3] Search for incorrect `font-mono` usage in non-code contexts: `grep -r "font-mono" app/routes/`
- [ ] T064 [US3] Document all font violations found in audit

**Sub-Phase 5b: Font Standardization**

- [ ] T065 [P] [US3] Fix font-mono misuse in Article component: update `app/components/Article.tsx` to use `font-neo` for headings
- [ ] T066 [P] [US3] Fix font inconsistencies in Subarticle component: update `app/components/Subarticle.tsx`
- [ ] T067 [P] [US3] Remove hardcoded `font-family: 'Inter'` from global CSS in `app/styles/index.css`
- [ ] T068 [P] [US3] Update any routes with hardcoded fonts to use theme utilities
- [ ] T069 [US3] Standardize code block styling to use `font-mono` consistently across all routes

**Sub-Phase 5c: ESLint Enforcement**

- [ ] T070 [US3] Add ESLint rule to forbid hardcoded font families in `.eslintrc.cjs`
- [ ] T071 [US3] Add ESLint rule to enforce theme-based font classes only

**Sub-Phase 5d: Validation**

- [ ] T072 [US3] Run font usage validation: verify zero hardcoded fonts: `grep -r "fontFamily\|font-family" app/ | grep -v "font-neo\|font-mono"`
- [ ] T073 [US3] Visual inspection: check typography consistency across all pages in browser
- [ ] T074 [US3] Run TypeScript type checking: `npm run typecheck`
- [ ] T075 [US3] Run ESLint validation: `npm run lint`
- [ ] T076 [US3] Run visual regression tests: `npm run test:visual`

**Checkpoint**: All user stories 1-3 should now be independently functional - consistent styling, modular components, unified typography

---

## Phase 6: User Story 4 - Consistent Code Patterns & Export Conventions (Priority: P4)

**Goal**: Establish and enforce consistent component structure, export patterns, and TypeScript typing across codebase

**Independent Test**: Audit components for pattern compliance, verify linting enforces standards, check documentation exists

### Implementation for User Story 4

**Sub-Phase 6a: Component Pattern Audit**

- [ ] T077 [US4] Audit all components in `app/components/` for inconsistent export patterns (default vs named)
- [ ] T078 [US4] Audit all routes in `app/routes/` for missing TypeScript prop interfaces
- [ ] T079 [US4] Audit all hooks in `app/hooks/` for consistent naming (use prefix) and export patterns
- [ ] T080 [US4] Document pattern violations found in audit

**Sub-Phase 6b: Pattern Standardization**

- [ ] T081 [P] [US4] Standardize component exports: ensure all components use default export with named type exports
- [ ] T082 [P] [US4] Add TypeScript interfaces to all components missing explicit prop types
- [ ] T083 [P] [US4] Standardize hook naming: ensure all hooks use `use` prefix and named exports
- [ ] T084 [P] [US4] Standardize component file structure: imports → interfaces → component → exports
- [ ] T085 [US4] Update all components to follow approved file structure from code standards

**Sub-Phase 6c: ESLint & TypeScript Enforcement**

- [ ] T086 [US4] Configure import ordering in `.eslintrc.cjs` to enforce consistent import organization
- [ ] T087 [US4] Add `@typescript-eslint/no-explicit-any` rule to prevent any types
- [ ] T088 [US4] Add file size warning at 500 lines in `.eslintrc.cjs`
- [ ] T089 [US4] Configure TypeScript strict boolean expressions in `tsconfig.json`

**Sub-Phase 6d: Documentation**

- [ ] T090 [US4] Update code standards in `docs/code-standards.md` with approved patterns and examples
- [ ] T091 [US4] Create component template file showing approved structure in `docs/templates/component-template.tsx`
- [ ] T092 [US4] Create hook template file showing approved structure in `docs/templates/hook-template.ts`
- [ ] T093 [US4] Document export conventions in `docs/code-standards.md`

**Sub-Phase 6e: Validation**

- [ ] T094 [US4] Run pattern compliance check: verify all components follow standards
- [ ] T095 [US4] Run TypeScript strict type checking: `npm run typecheck`
- [ ] T096 [US4] Run ESLint with all new rules: `npm run lint`
- [ ] T097 [US4] Code review: manually verify pattern consistency across sample components
- [ ] T098 [US4] Verify documentation covers all common scenarios

**Checkpoint**: All 4 user stories complete - consistent styling, modular architecture, unified typography, enforced patterns

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements that affect multiple user stories and overall codebase quality

- [ ] T099 [P] Run full visual regression suite across all routes: `npm run test:visual`
- [ ] T100 [P] Run complete TypeScript type checking: `npm run typecheck`
- [ ] T101 [P] Run complete ESLint validation: `npm run lint`
- [ ] T102 [P] Run full test suite: `npm test`
- [ ] T103 [P] Check bundle size hasn't regressed: `npm run analyze`
- [ ] T104 [P] Run Lighthouse audits on key pages to verify performance maintained
- [ ] T105 Update CLAUDE.md with modernization patterns and new component locations
- [ ] T106 Create migration guide in `docs/migration-guide.md` documenting the modernization changes
- [ ] T107 [P] Update README with new code standards link
- [ ] T108 Final code review: verify all modernization goals met
- [ ] T109 Merge feature branch to master after all validations pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P2): Can start after Foundational - No dependencies on other stories
  - User Story 3 (P3): Can start after Foundational - No dependencies on other stories
  - User Story 4 (P4): Can start after Foundational - No dependencies on other stories
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - establishes styling foundation
- **User Story 2 (P2)**: Independent - focuses on component decomposition
- **User Story 3 (P3)**: Independent - standardizes typography
- **User Story 4 (P4)**: Independent - enforces code patterns

All user stories can be worked on in **parallel** after Foundational phase completes.

### Within Each User Story

- Visual tests (if applicable) → Create baselines → Implementation → Validation
- Parallel tasks marked [P] within sub-phases can run concurrently
- Validation tasks depend on implementation completion

### Parallel Opportunities

**Phase 1 (Setup)**: Tasks T002-T008 can all run in parallel after T001 completes

**Phase 2 (Foundational)**: Tasks T009-T015 (all shared components and hooks) can run in parallel

**User Story 1**:
- T018-T023: Visual tests can run in parallel
- T024-T029: Route refactoring can run in parallel (different files)
- T033-T034: Component updates can run in parallel

**User Story 2**:
- T040-T041: Visual tests can run in parallel
- T053-T055: Shared pattern extraction can run in parallel

**User Story 3**:
- T065-T069: Font fixes can run in parallel (different files)

**User Story 4**:
- T081-T084: Pattern standardization can run in parallel (different concerns)
- T090-T093: Documentation tasks can run in parallel

**Phase 7 (Polish)**: Tasks T099-T104, T107 can run in parallel

---

## Parallel Example: User Story 1 - Legacy Route Refactoring

```bash
# Launch all visual tests together:
Task: "Create visual test for theRiddler route in tests/visual/theRiddler.spec.ts"
Task: "Create visual test for set route in tests/visual/set.spec.ts"
Task: "Create visual test for SSBM route in tests/visual/SSBM.spec.ts"
Task: "Create visual test for camelUpCup route in tests/visual/camelUpCup.spec.ts"
Task: "Create visual test for generativeArt route in tests/visual/generativeArt.spec.ts"
Task: "Create visual test for boulderingTracker route in tests/visual/boulderingTracker.spec.ts"

# After baselines captured, launch all route refactoring together:
Task: "Refactor theRiddler route in app/routes/theRiddler.tsx"
Task: "Refactor set route in app/routes/set.tsx"
Task: "Refactor SSBM route in app/routes/SSBM.tsx"
Task: "Refactor camelUpCup route in app/routes/camelUpCup.tsx"
Task: "Refactor generativeArt route in app/routes/generativeArt.tsx"
Task: "Refactor boulderingTracker route in app/routes/boulderingTracker.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install tooling)
2. Complete Phase 2: Foundational (shared components, baselines)
3. Complete Phase 3: User Story 1 (eliminate inline styles)
4. **STOP and VALIDATE**: Run visual regression, verify no inline styles
5. Merge to master if ready (MVP achieved!)

**Value Delivered**: Consistent Tailwind-based styling, foundation for future work

### Incremental Delivery

1. **Foundation** (Phase 1-2): Tooling + shared components ready
2. **US1** (Phase 3): No inline styles → Test → Deploy (MVP!)
3. **US2** (Phase 4): Modular components → Test → Deploy
4. **US3** (Phase 5): Unified typography → Test → Deploy
5. **US4** (Phase 6): Enforced patterns → Test → Deploy
6. **Polish** (Phase 7): Final validation → Deploy

Each story adds value without breaking previous work.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (critical path)
2. Once Foundational done, split work:
   - **Developer A**: User Story 1 (inline styles)
   - **Developer B**: User Story 2 (decomposition)
   - **Developer C**: User Story 3 (typography)
   - **Developer D**: User Story 4 (patterns)
3. Stories complete independently and merge sequentially

---

## Task Summary

**Total Tasks**: 109 tasks

**Breakdown by Phase**:
- Phase 1 (Setup): 8 tasks
- Phase 2 (Foundational): 9 tasks
- Phase 3 (US1 - Styling): 22 tasks
- Phase 4 (US2 - Components): 21 tasks
- Phase 5 (US3 - Typography): 16 tasks
- Phase 6 (US4 - Patterns): 22 tasks
- Phase 7 (Polish): 11 tasks

**Breakdown by User Story**:
- US1 (Standardized Styling): 22 tasks
- US2 (Modular Components): 21 tasks
- US3 (Unified Typography): 16 tasks
- US4 (Consistent Patterns): 22 tasks

**Parallel Opportunities**: 47 tasks marked [P] can run in parallel within their phases

**Independent Test Criteria**:
- US1: Zero inline styles, Tailwind-only, visual regression passes
- US2: All routes <500 lines, components extracted, hooks created
- US3: Zero hardcoded fonts, theme fonts only, typography consistent
- US4: Pattern compliance, linting enforced, documentation complete

**Suggested MVP Scope**: Phase 1-3 (Setup + Foundational + User Story 1)
- Delivers: Consistent styling foundation, shared components, no inline styles
- Validates: Visual regression testing, Tailwind patterns work
- Risk: Low (incremental changes, well-tested)

---

## Notes

- All tasks include exact file paths for clarity
- [P] tasks operate on different files and can run concurrently
- [Story] labels map tasks to user stories for traceability
- Each user story is independently completable and testable
- Visual regression tests prevent unintended layout changes
- ESLint enforcement catches violations automatically
- Constitution compliance: Minimalism (refactoring only), Quality (tests + linting), Safety (no environment changes)
- Stop at any checkpoint to validate story independently
- Commit after each task or logical group of related tasks
- Incremental approach minimizes risk of breaking changes
