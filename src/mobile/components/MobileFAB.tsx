import React from 'react';

type MobileFABProps = {
  icon: React.ReactNode;
  onClick: () => void;
  position?: 'bottom-right' | 'bottom-center';
};

export default function MobileFAB({ icon, onClick, position = 'bottom-right' }: MobileFABProps) {
  const positionStyles: React.CSSProperties = position === 'bottom-right' 
    ? { bottom: '86px', right: '16px' } 
    : { bottom: '86px', left: '50%', transform: 'translateX(-50%)' };

  return (
    <button
      onClick={onClick}
      className="mobile-no-select"
      style={{
        position: 'fixed',
        ...positionStyles,
        width: '56px',
        height: '56px',
        borderRadius: '28px',
        backgroundColor: 'var(--mobile-primary)',
        color: '#ffffff',
        border: 'none',
        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 45,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 0.2s ease',
      }}
    >
      {icon}
    </button>
  );
}
