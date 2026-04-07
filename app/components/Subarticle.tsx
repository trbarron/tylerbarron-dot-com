import { ReactNode } from 'react';

interface SubarticleProps {
  children: ReactNode;
  subtitle?: string;
}

export function Subarticle({ children, subtitle }: SubarticleProps) {
  return (
    <section className="my-8 prose">
      {subtitle && (
        <h3 className="text-2xl lg:text-3xl mb-6 ml-4 lg:ml-8 font-extrabold text-black border-l-8 border-black pl-4 uppercase font-neo">
          {subtitle}
        </h3>
      )}
      <div className="bg-white overflow-hidden break-words">
        {children}
      </div>
    </section>
  );
}