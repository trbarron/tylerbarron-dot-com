import type { ReactNode } from "react";

interface ArticleProps {
    title: string;
    subtitle: string;
    styleModifier?: string;
    children?: ReactNode;
}

export default function Article({ title, subtitle, styleModifier = "", children }: ArticleProps) {
    const modifiedClassName = "relative flex flex-col min-w-0 break-words bg-white/95 backdrop-blur-sm w-full border-4 border-black lg:max-w-4xl lg:mx-auto px-6 overflow-x-hidden " + styleModifier;

    return (
        <section className="relative container mx-auto px-4 my-12 font-neo">
            <div className={modifiedClassName}>
                {title && (
                    <div className="mt-8 mb-4 border-b-4 border-black pb-4">
                        <h1 className="text-4xl lg:text-6xl tracking-tighter text-black font-extrabold font-neo">
                            {title.toUpperCase()}
                        </h1>
                        {subtitle && (
                          <h2 className="text-xl lg:text-2xl text-black mt-2 font-bold opacity-80 uppercase">
                              {subtitle}
                          </h2>
                        )}
                    </div>
                )}
                <div className="prose">
                    {children}
                </div>
            </div>
        </section>
    );
}