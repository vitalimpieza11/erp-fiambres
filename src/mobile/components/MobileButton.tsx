import React from 'react';

type MobileButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

export default function MobileButton({
  children,
  variant = 'primary',
  fullWidth = false,
  size = 'md',
  style,
  ...props
}: MobileButtonProps) {
  const baseStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: fullWidth ? '100%' : 'auto',
    WebkitTapHighlightColor: 'transparent',
    fontFamily: 'inherit',
    ...style,
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '8px 16px', fontSize: '14px', minHeight: '36px' },
    md: { padding: '12px 24px', fontSize: '16px', minHeight: '48px' },
    lg: { padding: '16px 32px', fontSize: '18px', minHeight: '56px' },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--mobile-primary)',
      color: '#fff',
      boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.2)',
    },
    secondary: {
      backgroundColor: 'var(--mobile-primary-light)',
      color: 'var(--mobile-primary)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--mobile-text-primary)',
      border: '1px solid var(--mobile-border)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--mobile-text-secondary)',
    },
  };

  return (
    <button
      style={{
        ...baseStyles,
        ...sizeStyles[size],
        ...variantStyles[variant],
        opacity: props.disabled ? 0.6 : 1,
      }}
      className="mobile-no-select"
      {...props}
    >
      {children}
    </button>
  );
}
