import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * Card component with consistent border styling.
 *
 * @example
 * ```tsx
 * <Card>
 *   <h2>Title</h2>
 *   <p>Content</p>
 * </Card>
 * ```
 */
export default function Card({
  children,
  className = '',
  onClick,
}: CardProps) {
  const baseClasses = 'bg-white border-4 border-black p-6 mb-4';
  const interactiveClass = onClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : '';

  return (
    <div
      className={`${baseClasses} ${interactiveClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export type { CardProps };
