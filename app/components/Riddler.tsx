import { ReactNode } from "react";

interface RiddlerProps {
  children: ReactNode;
}

const formatChildren = (children: ReactNode) => {
  if (!children) return null;
  
  const formatChild = (child: ReactNode) => {
    if (typeof child === "string") {
      return (
        <div className="w-full px-4 my-4 text-md leading-relaxed text-gray-light">
          {child}
        </div>
      );
    }
    return child;
  };

  return Array.isArray(children)
    ? children.map(formatChild)
    : formatChild(children);
};

const Riddler = ({ children }: RiddlerProps) => {
  return (
    <section className="flex flex-wrap justify-center w-full bg-gray mx-auto rounded shadow-md lg:w-3/4">
      {formatChildren(children)}
    </section>
  );
};

export default Riddler;