import { ReactNode } from 'react';

interface RiddlerProps {
  children: ReactNode;
}

const formatChildren = (children: ReactNode) => {
  if (!children) return null;

  const formatChild = (child: ReactNode) => {
    if (typeof child === 'string') {
      return <div className="text-md text-gray-light my-4 w-full px-4 leading-relaxed">{child}</div>;
    }
    return child;
  };

  return Array.isArray(children) ? children.map(formatChild) : formatChild(children);
};

const Riddler = ({ children }: RiddlerProps) => {
  return (
    <section className="bg-gray mx-auto flex w-full flex-wrap justify-center lg:w-3/4">
      {formatChildren(children)}
    </section>
  );
};

export default Riddler;
