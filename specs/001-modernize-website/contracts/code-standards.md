# Code Standards: Website Modernization

**Feature**: 001-modernize-website | **Version**: 1.0.0 | **Date**: 2025-12-30

## Purpose

This document defines approved patterns and conventions for modernizing the Tyler Barron website codebase. These standards enforce consistency across components, styling, and architecture, transforming three development waves into a unified modern codebase.

## Target Architecture

**Reference Implementation**: The ChesserGuesser component suite represents the approved modern pattern. All refactored code should follow similar conventions.

## Component Standards

### File Structure

All component files must follow this structure:

```typescript
// 1. Imports (grouped)
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLoaderData } from 'react-router';
import { CustomComponent } from '~/components/CustomComponent';

// 2. TypeScript Interfaces
interface ComponentProps {
  title: string;
  children?: ReactNode;
  onClick?: () => void;
}

// 3. Component Definition
export default function ComponentName({ title, children, onClick }: ComponentProps) {
  // 3a. Hooks (in order: state, effects, custom hooks)
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Effect logic
  }, []);

  // 3b. Event Handlers
  const handleClick = () => {
    setIsActive(true);
    onClick?.();
  };

  // 3c. Render Logic
  return (
    <div className="container">
      <h1 className="text-2xl font-neo">{title}</h1>
      {children}
    </div>
  );
}
```

### Export Conventions

- **Route files**: Use **default export** (required by React Router 7)
  ```typescript
  export default function RouteComponent() { ... }
  ```

- **Shared components**: Use **default export** for primary component, named exports for related types
  ```typescript
  export default function Button({ variant, children }: ButtonProps) { ... }
  export type { ButtonProps };
  ```

- **Utility functions**: Use **named exports**
  ```typescript
  export function formatDate(date: Date): string { ... }
  export function validateEmail(email: string): boolean { ... }
  ```

- **Custom hooks**: Use **named exports** with `use` prefix
  ```typescript
  export function useGameState(): UseGameStateReturn { ... }
  export function useLocalStorage<T>(key: string, initial: T): [T, Setter<T>] { ... }
  ```

### TypeScript Standards

**Required**:
- All component props must have explicit interfaces
- No `any` types (use `unknown` if truly dynamic)
- Enable strict mode (already configured)
- Use type imports when importing only types: `import type { Foo } from 'bar'`

**Example**:
```typescript
// ✅ GOOD
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}

export default function Button({ variant, onClick, disabled, children }: ButtonProps) {
  // Implementation
}

// ❌ BAD
export default function Button(props: any) { ... }
```

### File Size Limits

- **Route files**: Target < 200 lines (routing + composition only)
- **Component files**: Target < 300 lines (single responsibility)
- **Hook files**: Target < 200 lines (focused logic)
- **Maximum**: 500 lines (constitutional limit, ESLint warning)

**Decomposition Strategy**:
If a file exceeds limits:
1. Extract feature components to separate files
2. Extract complex logic to custom hooks
3. Extract repeated JSX to sub-components
4. Move constants/types to dedicated files

## Styling Standards

### Tailwind CSS Only

**Required**: All styling must use Tailwind utility classes. Zero inline `style={}` objects.

```typescript
// ✅ GOOD
<div className="flex items-center justify-between p-4 bg-white border-4 border-black">
  <h2 className="text-xl font-bold font-neo">Title</h2>
</div>

// ❌ BAD
<div style={{ display: 'flex', padding: '1rem', background: 'white' }}>
  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Title</h2>
</div>
```

### Theme-Based Fonts

**Required**: Use only theme-defined font utilities.

- **Body text**: `font-neo` (Inter) or no class (defaults to theme)
- **Code blocks**: `font-mono` (JetBrains Mono)
- **No hardcoded fonts**: Never use `font-family` in styles

```typescript
// ✅ GOOD
<p className="text-base font-neo">Body text</p>
<code className="font-mono">const x = 42;</code>

// ❌ BAD
<p style={{ fontFamily: 'Inter' }}>Body text</p>
<p className="font-mono">Body text</p>  {/* Wrong context */}
```

### Responsive Design

Use Tailwind's responsive modifiers consistently:

```typescript
<div className="
  grid grid-cols-1           // Mobile: single column
  md:grid-cols-2             // Tablet: 2 columns
  lg:grid-cols-3             // Desktop: 3 columns
  gap-4 p-4
">
```

### Color Palette

Use theme-defined colors from `app.css`:

```typescript
// Primary colors
className="bg-white text-black"           // Default
className="bg-black text-white"           // Inverted
className="border-black border-4"         // Borders

// Semantic colors
className="bg-red-500 text-white"         // Danger/error
className="bg-green-500 text-white"       // Success
className="bg-blue-500 text-white"        // Info
```

### Dark Mode (if applicable)

Use `dark:` modifier for dark mode support:

```typescript
<div className="bg-white dark:bg-gray-900 text-black dark:text-white">
```

## Component Patterns

### Shared Components

Extract UI patterns used in **2+ routes** as shared components in `app/components/`.

**Approved Shared Components**:

1. **PhotoGallery** - Image galleries with lightbox
2. **Modal** - Generic modal dialogs
3. **Button** - Standardized buttons
4. **Card** - Content cards with borders
5. **ArticleLayout** - Blog post layout wrapper

**Usage Pattern**:
```typescript
// app/routes/myRoute.tsx
import PhotoGallery from '~/components/PhotoGallery';

export default function MyRoute() {
  const images = ['/image1.jpg', '/image2.jpg'];
  return <PhotoGallery images={images} layout="grid" lightbox />;
}
```

### Custom Hooks

Extract complex logic from components to custom hooks in `app/hooks/`.

**Naming**: `use` prefix, descriptive name, camelCase

**Example**:
```typescript
// app/hooks/useGameState.ts
export function useGameState(initialBoard: ChessBoard) {
  const [board, setBoard] = useState(initialBoard);
  const [moves, setMoves] = useState<Move[]>([]);

  const makeMove = (move: Move) => {
    // Move logic
  };

  return { board, moves, makeMove };
}

// Usage in route
import { useGameState } from '~/hooks/useGameState';

export default function ChessRoute() {
  const { board, moves, makeMove } = useGameState(initialBoard);
  // ...
}
```

### Route File Pattern

Route files should be minimal - handle routing concerns only:

```typescript
// app/routes/myRoute.tsx
import type { Route } from './+types/myRoute';
import FeatureComponent from '~/components/FeatureComponent';

// Loader for data fetching
export async function loader({ request }: Route.LoaderArgs) {
  const data = await fetchData();
  return { data };
}

// Action for form submissions
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  // Handle submission
  return redirect('/success');
}

// Component for rendering
export default function MyRoute() {
  const { data } = useLoaderData<typeof loader>();

  return <FeatureComponent data={data} />;
}
```

**Route responsibilities**:
- Data loading (`loader`)
- Form handling (`action`)
- Meta tags (`meta` export)
- Error boundaries (`ErrorBoundary` export)
- **NOT**: Complex UI logic, large JSX trees

## State Management

### Local State

Use `useState` for component-local state:

```typescript
const [isOpen, setIsOpen] = useState(false);
const [count, setCount] = useState(0);
```

### Shared State (Props Drilling)

Pass state through props for simple parent-child communication:

```typescript
function Parent() {
  const [user, setUser] = useState<User | null>(null);
  return <Child user={user} onUserChange={setUser} />;
}
```

### Persistent State

Use `useLocalStorage` hook for client-side persistence:

```typescript
import { useLocalStorage } from '~/hooks/useLocalStorage';

function Component() {
  const [settings, setSettings] = useLocalStorage('app-settings', defaultSettings);
  // Automatically syncs with localStorage
}
```

**Do NOT use**:
- Context API (not needed for current scope)
- Redux/Zustand (unnecessary complexity)
- Global variables (breaks React paradigms)

## ESLint Rules

### Enforced Rules

```json
{
  "rules": {
    // Forbid inline styles
    "react/forbid-dom-props": ["error", {
      "forbid": [{
        "propName": "style",
        "message": "Use Tailwind utility classes instead of inline styles"
      }]
    }],

    // File size limits
    "max-lines": ["warn", {
      "max": 500,
      "skipBlankLines": true,
      "skipComments": true
    }],

    // TypeScript strict
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/strict-boolean-expressions": "error",

    // Import organization
    "import/order": ["error", {
      "groups": [
        "builtin",
        "external",
        "internal",
        "parent",
        "sibling",
        "index"
      ],
      "newlines-between": "always"
    }]
  }
}
```

### Pre-Commit Checks

All commits must pass:
```bash
npm run lint        # ESLint validation
npm run typecheck   # TypeScript compilation
npm run format      # Prettier formatting (auto-fix)
```

## Testing Standards

### Component Tests

Test extracted components independently:

```typescript
// tests/components/Button.spec.ts
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '~/components/Button';

test('Button renders with correct variant', () => {
  render(<Button variant="primary">Click me</Button>);
  const button = screen.getByRole('button');
  expect(button).toHaveClass('bg-blue-500'); // Primary variant
});

test('Button calls onClick handler', () => {
  const handleClick = vi.fn();
  render(<Button variant="primary" onClick={handleClick}>Click</Button>);
  fireEvent.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalledOnce();
});
```

### Visual Regression Tests

Use Playwright for screenshot-based testing:

```typescript
// tests/visual/routes.spec.ts
import { test, expect } from '@playwright/test';

test('theRiddler route matches baseline', async ({ page }) => {
  await page.goto('/theRiddler');
  await expect(page).toHaveScreenshot('theRiddler.png', {
    maxDiffPixels: 100  // Allow minor rendering differences
  });
});
```

### Existing Tests

**Requirement**: All existing tests must continue to pass after refactoring.

```bash
npm test  # Must pass with 100% of existing tests
```

## Documentation Standards

### Component Documentation

Add JSDoc comments for complex components:

```typescript
/**
 * PhotoGallery displays a grid or masonry layout of images
 * with optional lightbox functionality.
 *
 * @example
 * ```tsx
 * <PhotoGallery
 *   images={['/img1.jpg', '/img2.jpg']}
 *   layout="grid"
 *   lightbox
 * />
 * ```
 */
interface PhotoGalleryProps { ... }
export default function PhotoGallery({ ... }: PhotoGalleryProps) { ... }
```

### README Updates

Update component README if creating new shared component directory:

```markdown
# Components

## PhotoGallery

Image gallery component with grid/masonry layouts and lightbox support.

**Props**: See `PhotoGallery.tsx` for full interface.

**Usage**: Import from `~/components/PhotoGallery`
```

## Migration Checklist

Use this checklist when refactoring a route:

- [ ] Read entire route file to understand functionality
- [ ] Identify inline styles → map to Tailwind classes
- [ ] Identify hardcoded fonts → replace with theme utilities
- [ ] Extract repeated JSX → create shared components
- [ ] Extract complex logic → create custom hooks
- [ ] Update imports to use new components/hooks
- [ ] Verify TypeScript interfaces for all props
- [ ] Run `npm run lint` and `npm run typecheck`
- [ ] Run visual regression test for route
- [ ] Verify existing functionality works (manual testing)
- [ ] Verify existing tests pass (`npm test`)
- [ ] Update route to use Tailwind-only styling
- [ ] Commit with descriptive message

## Anti-Patterns to Avoid

### ❌ Inline Styles
```typescript
// BAD
<div style={{ margin: '20px', color: 'red' }}>
```

### ❌ Hardcoded Fonts
```typescript
// BAD
<p style={{ fontFamily: 'Inter' }}>Text</p>
<p className="font-mono">Body text</p>  // Wrong context
```

### ❌ Large Route Files
```typescript
// BAD - 800+ lines in route file
export default function MyRoute() {
  // Tons of JSX and logic
}
```

### ❌ Prop Drilling Hell
```typescript
// BAD - passing props through 5+ levels
<A prop={x}><B prop={x}><C prop={x}>...</C></B></A>
// Better: Use custom hook or extract component
```

### ❌ Any Types
```typescript
// BAD
function process(data: any) { ... }

// GOOD
function process(data: unknown) {
  if (typeof data === 'string') { ... }
}
```

## Reference Implementations

### ✅ ChesserGuesser Suite

**Files**:
- `app/routes/chesserGuesser.tsx` - Route file (needs decomposition)
- `app/components/ChesserGuesser/ModeSwitcher.tsx` - Clean component
- `app/components/ChesserGuesser/UsernameModal.tsx` - Modal pattern
- `app/components/ChesserGuesser/DailyProgressTracker.tsx` - Complex component
- `app/components/ChesserGuesser/Leaderboard.tsx` - Data display

**Why it's good**:
- Modern Tailwind 4 patterns
- Proper TypeScript interfaces
- Component decomposition
- Clean separation of concerns
- Theme-based styling

### ✅ Article/Subarticle Components

**After standardization**, these should be reference implementations for:
- Typography consistency
- Font usage
- Content layout patterns

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-30 | Initial code standards for modernization feature |

## Enforcement

These standards are enforced through:
1. **ESLint**: Automated linting catches violations
2. **TypeScript**: Type checking prevents unsafe code
3. **Code Review**: Human verification of patterns
4. **Visual Regression**: Screenshot tests catch layout breaks
5. **Pre-Commit Hooks**: Blocks commits that violate standards

## Questions?

Refer to:
- This document for approved patterns
- ChesserGuesser suite for reference implementations
- Constitution (`constitution.md`) for overarching principles
- Project README (`.specify/memory/constitution.md`) for development workflow
