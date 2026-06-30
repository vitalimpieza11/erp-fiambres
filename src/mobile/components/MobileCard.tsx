import React from 'react';

type MobileCardProps = {
  children: React.ReactNode;
  onClick?: () => void;
  noPadding?: boolean;
  style?: React.CSSProperties;
};

export default function MobileCard({ children, onClick, noPadding = false, style }: MobileCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--mobile-surface)',
        borderRadius: '16px',
        padding: noPadding ? '0' : '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
        marginBottom: '12px',
        cursor: onClick ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
        border: '1px solid var(--mobile-border)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
