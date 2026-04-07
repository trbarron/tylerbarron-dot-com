interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

/**
 * Neo-Brutalist Skeleton component for loading states.
 * Instead of soft pulses, it uses a high-contrast "shimmer" or a static pattern
 * to remain consistent with the project's utilitarian aesthetic.
 */
export default function Skeleton({ 
  className = '', 
  variant = 'rect' 
}: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 w-full',
    rect: 'h-full w-full',
    circle: 'h-full w-full rounded-full',
  };

  // High-contrast shimmering animation using a repeating linear gradient
  const shimmerBase = 'bg-gray-100 relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent';

  const baseClasses = `border-2 border-black/10 ${shimmerBase}`;

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      aria-hidden="true"
    />
  );
}
