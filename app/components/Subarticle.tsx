import { ReactNode } from 'react';

interface SubarticleProps {
  children: ReactNode;
  subtitle?: string;
}

export function Subarticle({ children, subtitle }: SubarticleProps) {
  return (
    <section className="my-4">
      {subtitle && <h2 className="text-2xl mb-4 ml-6 font-bold text-black  border-b-2 border-accent pb-2 uppercase font-neo">{subtitle}</h2>}
      <div className="bg-white  overflow-hidden
                      [&_p]:text-black [&_p]: [&_p]:my-4 [&_p]:font-neo [&_p]:text-base [&_p]:leading-relaxed
                      [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:text-black [&_h3]: [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:font-neo [&_h3]:uppercase [&_h3]:border-b-2 [&_h3]:border-accent [&_h3]:pb-2
                      [&_h4]:text-xl [&_h4]:font-bold [&_h4]:text-black [&_h4]: [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-neo [&_h4]:uppercase
                      [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-gray-100 [&_blockquote]: [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:my-4 [&_blockquote]:font-neo
                      [&_blockquote_p]:text-black [&_blockquote_p]: [&_blockquote_p]:italic
                      [&_a]:text-black [&_a]: [&_a]:no-underline [&_a]:border-b-2 [&_a]:border-black [&_a]: [&_a]:pb-0.5 [&_a]:font-semibold [&_a]:transition-all
                      [&_a:hover]:bg-accent [&_a:hover]:text-white [&_a:hover]:border-accent [&_a:hover]:px-1 [&_a:hover]:-mx-1
                      [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-4 [&_ul]:text-black [&_ul]: [&_ul]:font-neo
                      [&_li]:text-black [&_li]: [&_li]:my-1 [&_li]:font-neo
                      [&_strong]:font-extrabold [&_strong]:text-black [&_strong]:
                      [&_em]:italic [&_em]:text-black [&_em]:
                      [&_img]:border-2 [&_img]:border-black [&_img]: [&_img]:my-4">
        {children}
      </div>
    </section>
  );
}