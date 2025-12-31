# Data Model: Website Modernization & Standardization

**Feature**: 001-modernize-website | **Date**: 2025-12-30

## Overview

This feature is a **refactoring effort** focused on code standardization and architectural consistency. It does not introduce new data entities, modify existing data schemas, or change data storage patterns. All data models remain unchanged.

## Existing Data Models (Unchanged)

The following data models exist in the application and are **not modified** by this feature:

### User Preferences (LocalStorage)
- **ChesserGuesser Scores**: Player performance data
- **Game State**: Collaborative Checkmate game persistence
- **Theme Preferences**: Dark mode toggles
- **Username**: Player identification

### Server-Side State (Redis)
- **Leaderboard Data**: Ranking information
- **Active Games**: Real-time game sessions
- **Session State**: User session management

### Content (S3 + MDX)
- **Blog Posts**: Compiled MDX content
- **Images**: CDN-hosted media files
- **Static Assets**: Public resources

## Component Props & Interfaces (New)

While no database schemas change, this feature introduces **TypeScript interfaces** for newly extracted shared components. These are runtime data structures, not persisted data:

### PhotoGallery Component
```typescript
interface PhotoGalleryProps {
  images: string[];           // Array of image URLs
  layout?: 'grid' | 'masonry'; // Display layout
  lightbox?: boolean;         // Enable lightbox on click
}
```

### Modal Component
```typescript
interface ModalProps {
  isOpen: boolean;           // Visibility state
  onClose: () => void;       // Close handler
  title?: string;            // Optional header
  children: ReactNode;       // Modal content
}
```

### Button Component
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger'; // Visual style
  size?: 'sm' | 'md' | 'lg';                   // Size variant
  disabled?: boolean;                          // Disabled state
  onClick?: () => void;                        // Click handler
  children: ReactNode;                         // Button content
}
```

### Card Component
```typescript
interface CardProps {
  children: ReactNode;       // Card content
  className?: string;        // Additional Tailwind classes
  onClick?: () => void;      // Optional click handler
}
```

### ArticleLayout Component
```typescript
interface ArticleLayoutProps {
  title: string;             // Article title
  subtitle: string;          // Article subtitle
  children: ReactNode;       // Article content
  styleModifier?: string;    // Optional custom classes
}
```

## Custom Hook Interfaces (New)

Extracted logic from large route files will be encapsulated in custom hooks with the following interfaces:

### useGameState Hook
```typescript
interface GameState {
  board: ChessBoard;         // Current board position
  moves: Move[];             // Move history
  currentPlayer: 'white' | 'black';
  gameStatus: 'active' | 'checkmate' | 'stalemate' | 'draw';
}

interface UseGameStateReturn {
  state: GameState;
  makeMove: (move: Move) => void;
  resetGame: () => void;
  undoMove: () => void;
}

function useGameState(): UseGameStateReturn;
```

### useLocalStorage Hook
```typescript
function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void];
```

### useLightbox Hook
```typescript
interface UseLightboxReturn {
  isOpen: boolean;
  currentIndex: number;
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
  nextImage: () => void;
  prevImage: () => void;
}

function useLightbox(images: string[]): UseLightboxReturn;
```

## Data Flow (Unchanged)

The modernization effort **does not alter** data flow patterns:

1. **Client State**: React component state via `useState`
2. **Persistence**: LocalStorage for client-side data
3. **Server Communication**: API routes for Redis/database interactions
4. **Content Delivery**: S3/CloudFront for static assets

## Validation Rules (Unchanged)

All existing validation rules remain intact:
- Form validation in interactive routes
- Chess move validation
- Input sanitization
- TypeScript type checking

## No Database Migrations Required

This feature requires **zero database migrations, schema changes, or data transformations**. It is purely a code refactoring effort focused on:
- Component structure
- Styling patterns
- Code organization
- TypeScript interfaces

## Summary

**Data Model Impact**: None

This document serves as a placeholder to maintain consistency with the planning template structure. The modernization feature operates entirely at the code organization and component architecture level, with no changes to persisted data, schemas, or data flow patterns.

All new TypeScript interfaces are compile-time constructs for type safety and developer experience, not runtime data models requiring storage or serialization.
