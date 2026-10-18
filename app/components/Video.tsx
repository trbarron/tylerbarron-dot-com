import { useState, useEffect } from 'react';

interface VideoProps {
  src: string;
  caption?: string;
}

export default function Video({ src, caption }: VideoProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  let captionText = '';
  let captionClassName = '';

  if (caption !== undefined) {
    captionText = caption;
    captionClassName = 'text-center text-gray-light text-sm pt-1';
  }

  if (!isMounted) {
    // Return a placeholder or null on the server side
    return null;
  }

  return (
    <section className="mx-auto h-fit w-3/4 justify-center lg:w-1/2">
      <div className="bg-gray h-full w-full rounded p-2 shadow-md">
        <iframe
          src={src}
          title={src}
          frameBorder="0"
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="h-60 w-full rounded"
        />
        <div className={captionClassName}>{captionText}</div>
      </div>
    </section>
  );
}
