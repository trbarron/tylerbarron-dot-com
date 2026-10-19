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
      onKeyDown={(e) => e.key === 'Enter' && onClick(index)}
      role="button"
      tabIndex={0}
      className="group my-8 cursor-pointer transition-all duration-200 hover:scale-105"
    >
      <div className="border-4 border-black bg-white p-2 transition-all duration-200 hover:bg-neutral-100">
        <img
          src={photo.src}
          alt={photo.alt}
          className="h-auto w-full border-2 border-black transition-all duration-200"
        />
        <p className="mt-4 border-t-2 border-black p-2 text-center font-semibold tracking-wide text-black uppercase">
          {photo.caption}
        </p>
      </div>
    </div>
  );
}
