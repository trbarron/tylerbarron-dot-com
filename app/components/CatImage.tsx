import { useState, useEffect } from 'react';

const ImageDisplay = () => {
  const [imageData, setImageData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timestamp, setTimestamp] = useState("");
  const [error, setError] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    const fetchImage = async () => {
      if (!isMounted) return;
      
      try {
        const response = await fetch('https://nj3ho46btl.execute-api.us-west-2.amazonaws.com/checoStage/checoRestEndpoint/image');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const responseData = await response.json();
        const data = JSON.parse(responseData.body);
        setImageData(data.image);
        setTimestamp(data.timestamp);
        setIsLoading(false);
      } catch (err) {
        setError(err.message || 'An error occurred while loading the image');
        setIsLoading(false);
      }
    };

    fetchImage();
  }, [isMounted]);

  if (!isMounted) {
    return null; // Return null on server-side render
  }

  if (isLoading) {
    return <div className="text-center text-black dark:text-white">Loading image...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 dark:text-red-400">{error}</div>;
  }

  return (
    <div className="text-center mb-4">
      {imageData && (
        <div>
          <img
            src={`data:image/jpeg;base64,${imageData}`}
            alt="Cat"
            className="mx-auto max-w-full h-auto border-2 border-black dark:!border-white"
          />
          <h4 className="text-black dark:text-white mt-2 font-neo">{timestamp}</h4>
        </div>
      )}
    </div>
  );
};

export default ImageDisplay;