import React from "react";

const formatChildren = (children) => {
  if (!children) return null;
  
  const formatChild = (child) => {
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

const Riddler = ({ children }) => {
  return (
    <section className="flex flex-wrap justify-center w-full bg-gray mx-auto rounded shadow-md lg:w-3/4">
      {formatChildren(children)}
    </section>
  );
};

export default Riddler;