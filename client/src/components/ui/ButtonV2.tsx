import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonV2Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95',
  secondary: 'bg-slate-50 text-slate-900 hover:bg-slate-100 border border-slate-200',
  tertiary: 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-95',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-xs font-medium',
  md: 'px-4 py-2.5 text-sm font-medium',
  lg: 'px-6 py-3 text-base font-semibold',
};

export const ButtonV2: React.FC<ButtonV2Props> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  isLoading = false,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={`flex items-center justify-center gap-2 rounded-lg transition-all duration-150 ${variantStyles[variant]} ${sizeStyles[size]} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {icon && !isLoading && <span className="flex-shrink-0">{icon}</span>}
      {isLoading && <span className="flex-shrink-0 animate-spin">⏳</span>}
      <span>{children}</span>
    </button>
  );
};
