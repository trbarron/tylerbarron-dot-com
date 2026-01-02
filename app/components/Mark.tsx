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
    <mark className="ml-16 mt-4 !block !bg-green-300 pl-2 py-1 uppercase">
      {children}
    </mark>
  );
}
