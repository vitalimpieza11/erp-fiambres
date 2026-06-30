import React, { useEffect, useState } from 'react';

type MobileBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: string; // e.g. '50vh', '90vh'
};

export default function MobileBottomSheet({ isOpen, onClose, title, children, height = '70vh' }: MobileBottomSheetProps) {
  const [render, setRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setRender(true);
  }, [isOpen]);

  if (!render) return null;

  return (
    <>
      {/* Backdrop (oscurece el fondo) */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 100,
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panel Inferior */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: height,
        backgroundColor: 'var(--mobile-surface)',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        zIndex: 101,
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.1, 0.9, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)'
      }}
      onTransitionEnd={() => {
        if (!isOpen) setRender(false);
      }}
      >
        {/* Handle de arrastre (visual) */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }} onClick={onClose}>
          <div style={{ width: '40px', height: '5px', backgroundColor: '#d1d5db', borderRadius: '3px' }} />
        </div>

        {title && (
          <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--mobile-border)' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{title}</h2>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </div>
    </>
  );
}
