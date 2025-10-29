import { ReactNode } from 'react';

interface SubarticleProps {
  children: ReactNode;
  subtitle?: string;
}

export function Subarticle({ children, subtitle }: SubarticleProps) {
  return (
    <section className="my-4">
      {subtitle && <h2 className="text-2xl mb-4 ml-6">{subtitle}</h2>}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {children}
      </div>
    </section>
  );
}