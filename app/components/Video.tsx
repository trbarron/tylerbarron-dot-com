import { useState, useEffect } from "react";

export default function Video({ src, caption }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  let captionText = "";
  let captionClassName = "";

  if (caption !== undefined) {
    captionText = caption;
    captionClassName = "text-center text-gray-light text-sm pt-1";
  }

  if (!isMounted) {
    // Return a placeholder or null on the server side
    return null;
  }

  return (
    <section className="justify-center mx-auto w-3/4 h-fit lg:w-1/2">
      <div className="p-2 bg-gray w-full h-full rounded shadow-md">
        <iframe
          src={src}
          title={src}
          frameBorder="0"
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="rounded w-full h-60"
        />
        <div className={captionClassName}>
          {captionText}
        </div>
      </div>
    </section>
  );
}