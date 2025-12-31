import { ReactNode } from 'react';

interface SubarticleProps {
  children: ReactNode;
  subtitle?: string;
}

export function Subarticle({ children, subtitle }: SubarticleProps) {
  return (
    <section className="my-4 prose">
      {subtitle && <h2 className="text-2xl mb-4 ml-6 font-bold text-black border-b-2 border-accent pb-2 uppercase font-neo">{subtitle}</h2>}
      <div className="bg-white overflow-hidden">
        {children}
      </div>
    </section>
  );
}