import { useState, useEffect } from 'react';

const ImageDisplay = () => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timestamp, setTimestamp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    const fetchImage = async () => {
      if (!isMounted) return;

      try {
        const response = await fetch(
          'https://nj3ho46btl.execute-api.us-west-2.amazonaws.com/checoStage/checoRestEndpoint/image',
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const responseData = await response.json();
        const data = JSON.parse(responseData.body);
        setImageData(data.image);
        setTimestamp(data.timestamp);
        setIsLoading(false);
      } catch (err) {
        setError((err as Error).message || 'An error occurred while loading the image');
        setIsLoading(false);
      }
    };

    fetchImage();
  }, [isMounted]);

  // Skeleton during SSR and while the camera image fetches. The camera
  // produces 4:3 frames, so the placeholder reserves the same footprint to
  // avoid layout shift when the image arrives.
  if (!isMounted || isLoading) {
    return (
      <div className="mb-4 text-center">
        <div className="mx-auto aspect-[4/3] w-full animate-pulse border-2 border-black bg-gray-200" />
        <div className="mx-auto mt-3 h-4 w-40 animate-pulse bg-gray-200" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center font-bold text-black">{error}</div>;
  }

  return (
    <div className="mb-4 text-center">
      {imageData && (
        <div>
          <img
            src={`data:image/jpeg;base64,${imageData}`}
            alt="Cat"
            className="mx-auto h-auto max-w-full border-2 border-black"
          />
          <h4 className="font-neo mt-2 text-black">{timestamp}</h4>
        </div>
      )}
    </div>
  );
};

export default ImageDisplay;
