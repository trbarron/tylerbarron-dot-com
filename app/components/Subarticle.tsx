import React from 'react';

export function Subarticle({ children, subtitle }) {
  return (
    <section className="my-8">
      {subtitle && <h2 className="text-xl font-semibold mb-4">{subtitle}</h2>}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {children}
      </div>
    </section>
  );
}