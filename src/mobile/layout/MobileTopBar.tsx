import React from 'react';

type MobileTopBarProps = {
  title?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
};

export default function MobileTopBar({ title, leftElement, rightElement }: MobileTopBarProps) {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      backgroundColor: 'var(--mobile-surface)',
      borderBottom: '1px solid var(--mobile-border)',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
    }}>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
        {leftElement}
      </div>
      
      {title && (
        <h1 style={{
          margin: 0,
          fontSize: '17px',
          fontWeight: 600,
          color: 'var(--mobile-text-primary)',
          flex: 2,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {title}
        </h1>
      )}

      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {rightElement}
      </div>
    </header>
  );
}
