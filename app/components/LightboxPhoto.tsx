import React from 'react';

interface Photo {
  src: string;
  alt: string;
  caption: string;
}

interface LightboxPhotoProps {
  photo: Photo;
  index: number;
  onClick: (index: number) => void;
}

export default function LightboxPhoto({ photo, index, onClick }: LightboxPhotoProps) {
  return (
    <div 
      onClick={() => onClick(index)} 
      className="cursor-pointer my-8 group transition-all duration-200 hover:scale-105"
    >
      <div className="border-4 border-black bg-white p-2 hover:shadow-lg transition-all duration-200">
        <img 
          src={photo.src} 
          alt={photo.alt} 
          className="w-full h-auto border-2 border-black transition-all duration-200" 
        />
        <p className="text-black font-semibold uppercase tracking-wide text-center mt-4 p-2 border-t-2 border-black">
          {photo.caption}
        </p>
      </div>
    </div>
  );
} 