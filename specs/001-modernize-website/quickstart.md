# Quickstart Guide: Website Modernization

**Feature**: 001-modernize-website | **Branch**: `001-modernize-website` | **Date**: 2025-12-30

## Overview

This guide helps developers get started with the website modernization effort. It covers setup, development workflow, and key patterns to follow when refactoring routes and components.

## Prerequisites

- Node.js 22+ installed
- Git repository cloned
- Familiarity with React, TypeScript, Tailwind CSS

## Quick Setup

### 1. Checkout Feature Branch

```bash
git checkout 001-modernize-website
```

### 2. Install Dependencies

```bash
npm install
```

New dependencies for this feature:
- `@playwright/test` - Visual regression testing

### 3. Verify Environment

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Tests
npm test
```

All commands should pass before starting work.

### 4. Set Up Visual Testing

```bash
# Install Playwright browsers
npx playwright install

# Create baseline screenshots (before refactoring)
npm run test:visual:baseline
```

## Development Workflow

### Refactoring a Route (Step-by-Step)

**Example**: Modernizing `theRiddler.tsx`

#### Step 1: Analyze Current State

```bash
# Open the route file
code app/routes/theRiddler.tsx

# Count lines
wc -l app/routes/theRiddler.tsx

# Search for inline styles
grep -n "style={{" app/routes/theRiddler.tsx

# Search for hardcoded fonts
grep -n "fontFamily" app/routes/theRiddler.tsx
```

#### Step 2: Create Visual Baseline

```bash
# Start dev server
npm run dev

# In another terminal, capture baseline
npx playwright test tests/visual/theRiddler.spec.ts --update-snapshots
```

#### Step 3: Refactor Inline Styles

**Before**:
```typescript
<div style={{
  cursor: 'pointer',
  margin: '20px auto',
  textAlign: 'center',
  maxWidth: '80%'
}}>
```

**After**:
```typescript
<div className="cursor-pointer mx-auto my-5 text-center max-w-[80%]">
```

**Conversion Reference**:
- `margin: '20px auto'` → `mx-auto my-5`
- `textAlign: 'center'` → `text-center`
- `maxWidth: '80%'` → `max-w-[80%]`
- `cursor: 'pointer'` → `cursor-pointer`

#### Step 4: Fix Font Usage

**Before**:
```typescript
<p style={{ fontFamily: 'Inter' }}>Text</p>
```

**After**:
```typescript
<p className="font-neo">Text</p>
```

Or remove the class entirely if Inter is the default theme font.

#### Step 5: Extract Shared Components (if applicable)

If the route has repeated patterns (modals, image galleries, etc.):

```bash
# Create shared component
code app/components/PhotoGallery.tsx
```

**Example**:
```typescript
// Before: Inline gallery in route
<div className="grid grid-cols-3 gap-4">
  {images.map(img => <img src={img} />)}
</div>

// After: Shared component
import PhotoGallery from '~/components/PhotoGallery';
<PhotoGallery images={images} layout="grid" />
```

#### Step 6: Validate Changes

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Visual regression (should match baseline)
npx playwright test tests/visual/theRiddler.spec.ts

# Manual testing
npm run dev
# Navigate to /theRiddler and verify functionality
```

#### Step 7: Commit Changes

```bash
git add app/routes/theRiddler.tsx
git commit -m "refactor(theRiddler): migrate inline styles to Tailwind

- Replace all style={{}} objects with Tailwind utility classes
- Standardize font usage with theme-based utilities
- Maintain visual consistency (verified with Playwright)
- Passes lint, typecheck, and visual regression tests"
```

## Common Patterns

### Pattern 1: Inline Style → Tailwind Class

```typescript
// ❌ BEFORE
<div style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem',
  backgroundColor: 'white',
  border: '4px solid black'
}}>

// ✅ AFTER
<div className="flex justify-between items-center p-4 bg-white border-4 border-black">
```

### Pattern 2: Font Standardization

```typescript
// ❌ BEFORE
<p style={{ fontFamily: 'Inter', fontSize: '16px' }}>Body text</p>
<code style={{ fontFamily: 'JetBrains Mono' }}>code</code>

// ✅ AFTER
<p className="text-base font-neo">Body text</p>
<code className="font-mono">code</code>
```

### Pattern 3: Extract Shared Component

```typescript
// ❌ BEFORE (repeated in multiple routes)
<div className="bg-white border-4 border-black p-6 mb-4">
  <h2>{title}</h2>
  <p>{content}</p>
</div>

// ✅ AFTER
// 1. Create app/components/Card.tsx
interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white border-4 border-black p-6 mb-4 ${className}`}>
      {children}
    </div>
  );
}

// 2. Use in routes
import Card from '~/components/Card';

<Card>
  <h2>{title}</h2>
  <p>{content}</p>
</Card>
```

### Pattern 4: Extract Custom Hook

```typescript
// ❌ BEFORE (complex logic in component)
export default function ChessRoute() {
  const [board, setBoard] = useState(initialBoard);
  const [moves, setMoves] = useState<Move[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');

  const makeMove = (move: Move) => {
    // 50 lines of complex logic
  };

  // More game logic...
}

// ✅ AFTER
// 1. Create app/hooks/useGameState.ts
export function useGameState(initialBoard: ChessBoard) {
  const [board, setBoard] = useState(initialBoard);
  const [moves, setMoves] = useState<Move[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');

  const makeMove = (move: Move) => {
    // Complex logic here
  };

  return { board, moves, currentPlayer, makeMove };
}

// 2. Use in route
import { useGameState } from '~/hooks/useGameState';

export default function ChessRoute() {
  const { board, moves, currentPlayer, makeMove } = useGameState(initialBoard);
  // Clean component focused on rendering
}
```

## Testing

### Visual Regression Testing

```bash
# Create baseline (before refactoring)
npm run test:visual:baseline

# Run tests (after refactoring)
npm run test:visual

# Update baseline (when intentional changes made)
npm run test:visual -- --update-snapshots
```

**When to update baselines**:
- Intentional visual improvements
- Layout adjustments approved in code review
- **Never** for accidental regressions

### Unit Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/components/Button.spec.ts

# Run in watch mode
npm test -- --watch
```

### Manual Testing Checklist

For each refactored route:

- [ ] Page loads without errors
- [ ] All interactive elements work (buttons, forms, modals)
- [ ] Layout matches original (use visual regression as reference)
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Dark mode works (if applicable)
- [ ] No console errors or warnings
- [ ] TypeScript compiles without errors
- [ ] ESLint passes without warnings

## File Organization

### Where to Put Things

**Route files**: `app/routes/`
- Routing logic, data loading, page composition
- Target: < 200 lines

**Shared components**: `app/components/`
- Reusable UI components used in 2+ routes
- Each component in its own file

**Custom hooks**: `app/hooks/`
- Reusable stateful logic
- Named with `use` prefix

**Types**: `app/types/`
- Shared TypeScript interfaces and types
- Domain models

**Utilities**: `app/utils/`
- Pure functions, helpers
- CDN utilities, formatters

**Tests**: `tests/`
- Component tests, integration tests
- Visual regression tests in `tests/visual/`

## Reference Implementations

### ✅ Good Examples to Follow

**ChesserGuesser Suite**:
- `app/components/ChesserGuesser/ModeSwitcher.tsx` - Clean component pattern
- `app/components/ChesserGuesser/UsernameModal.tsx` - Modal implementation
- `app/components/ChesserGuesser/DailyProgressTracker.tsx` - Complex component
- `app/components/ChesserGuesser/Leaderboard.tsx` - Data display

**Why they're good**:
- Modern Tailwind patterns (no inline styles)
- Proper TypeScript interfaces
- Component decomposition
- Theme-based fonts

### ⚠️ Routes Needing Modernization

**Legacy routes** (inline styles, needs Tailwind):
1. `app/routes/theRiddler.tsx`
2. `app/routes/set.tsx`
3. `app/routes/SSBM.tsx`
4. `app/routes/camelUpCup.tsx`
5. `app/routes/generativeArt.tsx`
6. `app/routes/boulderingTracker.tsx`

**Large routes** (needs decomposition):
1. `app/routes/chesserGuesser.tsx` (811 lines)
2. `app/routes/collaborativeCheckmate.$gameId.$playerId.tsx` (1023 lines)

**Font inconsistencies**:
1. `app/components/Article.tsx`
2. `app/components/Subarticle.tsx`

## Troubleshooting

### "Visual regression test failed"

**Cause**: Layout changed during refactoring

**Solution**:
1. Open diff images in `test-results/`
2. Compare side-by-side with baseline
3. If changes are intentional: `npm run test:visual -- --update-snapshots`
4. If changes are bugs: fix Tailwind classes to match baseline

### "TypeScript errors after refactoring"

**Cause**: Missing or incorrect prop types

**Solution**:
```typescript
// Add explicit interface
interface MyComponentProps {
  title: string;
  onClick?: () => void;
}

export default function MyComponent({ title, onClick }: MyComponentProps) {
  // ...
}
```

### "ESLint forbidding inline styles"

**Cause**: New ESLint rule blocks `style={{}}` usage

**Solution**: Convert to Tailwind classes (this is intentional!)

```typescript
// ❌ BAD (will fail lint)
<div style={{ margin: '20px' }}>

// ✅ GOOD
<div className="m-5">
```

### "Component too large (ESLint warning)"

**Cause**: File exceeds 500-line limit

**Solution**:
1. Extract sub-components to separate files
2. Move complex logic to custom hooks
3. Break feature into smaller focused components

## Code Standards Reference

For detailed standards, see: [`contracts/code-standards.md`](./contracts/code-standards.md)

**Quick Reference**:
- ✅ Tailwind classes only (no inline styles)
- ✅ Theme fonts only (`font-neo`, `font-mono`)
- ✅ TypeScript interfaces for all props
- ✅ Default exports for components
- ✅ Named exports for hooks/utils
- ✅ Files under 500 lines
- ✅ Extract shared patterns to `app/components/`

## Getting Help

**Documentation**:
- [Code Standards](./contracts/code-standards.md) - Approved patterns
- [Research](./research.md) - Technology decisions
- [Constitution](../../.specify/memory/constitution.md) - Project principles

**Reference Code**:
- ChesserGuesser components - Modern patterns
- Article/Subarticle (after modernization) - Typography

**Questions**:
- Check existing modernized routes for examples
- Review code standards for approved patterns
- Ask in code review if unsure about approach

## Next Steps

1. **Pick a route**: Start with simple legacy routes (theRiddler, set, SSBM)
2. **Follow workflow**: Baseline → Refactor → Validate → Commit
3. **Review patterns**: Reference ChesserGuesser for approved styles
4. **Test thoroughly**: Visual regression + manual testing
5. **Commit incrementally**: One route per commit

## Summary

**Goal**: Transform codebase from three development waves into unified modern architecture

**Approach**: Incremental refactoring with visual regression safety net

**Standards**: Tailwind-only styling, theme fonts, component decomposition

**Success**: All routes < 500 lines, zero inline styles, consistent patterns

Ready to start? Pick a legacy route and follow the refactoring workflow above!
