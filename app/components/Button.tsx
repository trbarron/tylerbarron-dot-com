import type { ReactNode } from 'react';

interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Standardized button component with consistent styling.
 *
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleClick}>
 *   Click Me
 * </Button>
 * ```
 */
export default function Button({
  variant,
  size = 'md',
  disabled = false,
  onClick,
  children,
  className = '',
  type = 'button',
}: ButtonProps) {
  const variantClasses = {
    primary: 'bg-white text-black border-4 border-black hover:bg-black hover:text-white',
    secondary: 'bg-black text-white border-4 border-black hover:bg-white hover:text-black',
  };

  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const baseClasses = 'font-bold font-neo uppercase tracking-wider transition-all duration-100 disabled:bg-gray-200 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant === 'danger' ? 'primary' : variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export type { ButtonProps };
