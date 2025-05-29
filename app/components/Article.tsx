import type { ReactNode } from "react";

interface ArticleProps {
    title: string;
    subtitle: string;
    styleModifier?: string;
    children?: ReactNode;
}

export default function Article({ title, subtitle, styleModifier = "", children }: ArticleProps) {
    const modifiedClassName = "relative flex flex-col min-w-0 break-words bg-white w-full border-4 border-black lg:w-8/12 lg:mx-auto px-6 " + styleModifier;

    return (
        <section className="relative container mx-auto px-4 my-12 font-mono">
            <div className={modifiedClassName}>
                <div className="mt-4">
                    <h3 className="text-3xl lg:text-4xl leading-tight text-black font-bold font-mono">
                        {title.toUpperCase()}
                    </h3>
                    <h2 className="text-xl lg:text-2xl text-black pb-2 font-mono">
                        {subtitle.toUpperCase()}
                    </h2>
                </div>
                {children}
            </div>
        </section>
    );
}