import type { ReactNode } from 'react';

interface ArticleLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  styleModifier?: string;
}

/**
 * Article layout component for blog posts and content pages.
 *
 * @example
 * ```tsx
 * <ArticleLayout
 *   title="My Article"
 *   subtitle="A deep dive into..."
 * >
 *   <p>Article content...</p>
 * </ArticleLayout>
 * ```
 */
export default function ArticleLayout({
  title,
  subtitle,
  children,
  styleModifier = '',
}: ArticleLayoutProps) {
  return (
    <article className={`max-w-4xl mx-auto px-4 py-8 ${styleModifier}`}>
      <header className="mb-8">
        <h1 className="text-4xl lg:text-5xl font-bold font-neo text-black mb-4">
          {title}
        </h1>
        <p className="text-xl text-gray-600 font-neo">
          {subtitle}
        </p>
      </header>
      <div className="prose prose-lg max-w-none font-neo">
        {children}
      </div>
    </article>
  );
}

export type { ArticleLayoutProps };
