import React, { useEffect, useState } from 'react';

type MobileToastProps = {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
  isOpen: boolean;
};

export default function MobileToast({ message, type = 'success', duration = 3000, onClose, isOpen }: MobileToastProps) {
  const [render, setRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setRender(true);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!render) return null;

  const bgColors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6'
  };

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '80px', /* Por encima de la navegación */
        left: '50%',
        transform: `translateX(-50%) translateY(${isOpen ? '0' : '150%'})`,
        opacity: isOpen ? 1 : 0,
        backgroundColor: bgColors[type],
        color: 'white',
        padding: '12px 24px',
        borderRadius: '30px',
        fontWeight: 600,
        fontSize: '14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 9999,
        transition: 'transform 0.3s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap'
      }}
      onTransitionEnd={() => {
        if (!isOpen) setRender(false);
      }}
    >
      {message}
    </div>
  );
}
