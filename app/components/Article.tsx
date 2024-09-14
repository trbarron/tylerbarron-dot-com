import type { ReactNode } from "react";

interface ArticleProps {
    title: string;
    subtitle: string;
    styleModifier?: string;
    children?: ReactNode;
}

export default function Article({ title, subtitle, styleModifier = "", children }: ArticleProps) {
    const modifiedClassName = "relative flex flex-col min-w-0 break-words bg-gray-light w-full shadow-md rounded-lg lg:w-8/12 lg:mx-auto px-6 " + styleModifier;

    return (
        <section className="relative container mx-auto px-4 my-12 font-body">
            <div className={modifiedClassName}>
                <div className="mt-4">
                    <h3 className="text-3xl lg:text-4xl leading-normal text-gray-dark ">
                        {title}
                    </h3>
                    <h2 className="text-xl lg:text-2xl text-red-clear pb-2">
                        {subtitle}
                    </h2>
                </div>
                {children}
            </div>
        </section>
    );
}