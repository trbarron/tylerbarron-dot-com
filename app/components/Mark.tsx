import type { ReactNode } from 'react';

interface MarkProps {
  children: ReactNode;
}

/**
 * Custom mark component for MDX blog posts
 * Replaces inline styles with Tailwind classes
 */
export default function Mark({ children }: MarkProps) {
  return (
    <mark className="ml-12 block !bg-green-300">
      {children}
    </mark>
  );
}
