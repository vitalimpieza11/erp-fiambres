import React, { useEffect, useState } from 'react';

type MobileConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function MobileConfirmDialog({ 
  isOpen, title, message, confirmText = 'Aceptar', cancelText = 'Cancelar', 
  confirmColor = 'var(--mobile-primary)', onConfirm, onCancel 
}: MobileConfirmDialogProps) {
  
  const [render, setRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setRender(true);
  }, [isOpen]);

  if (!render) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      {/* Backdrop */}
      <div 
        onClick={onCancel}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          opacity: isOpen ? 1 : 0, transition: 'opacity 0.2s ease'
        }} 
      />
      
      {/* Dialog */}
      <div 
        style={{
          backgroundColor: '#fff', borderRadius: '24px', width: '85%', maxWidth: '340px',
          padding: '24px', position: 'relative', zIndex: 1,
          transform: isOpen ? 'scale(1)' : 'scale(0.9)',
          opacity: isOpen ? 1 : 0, transition: 'all 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onTransitionEnd={() => { if (!isOpen) setRender(false); }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: 700, color: 'var(--mobile-text-primary)', textAlign: 'center' }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: 'var(--mobile-text-secondary)', textAlign: 'center', lineHeight: 1.4 }}>
          {message}
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={onConfirm}
            style={{
              width: '100%', height: '50px', borderRadius: '16px', border: 'none',
              backgroundColor: confirmColor, color: 'white', fontSize: '16px', fontWeight: 600
            }}
          >
            {confirmText}
          </button>
          <button 
            onClick={onCancel}
            style={{
              width: '100%', height: '50px', borderRadius: '16px', border: 'none',
              backgroundColor: 'transparent', color: 'var(--mobile-text-secondary)', fontSize: '16px', fontWeight: 600
            }}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
