import React from 'react';

export function Subarticle({ children, subtitle }) {
  return (
    <section className="my-4">
      {subtitle && <h2 className="text-2xl mb-4 ml-6">{subtitle}</h2>}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {children}
      </div>
    </section>
  );
}