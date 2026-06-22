import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import './AnalyticsModal.css';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AnalyticsModal({ isOpen, onClose, title, subtitle, children }: AnalyticsModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      document.body.style.overflow = '';
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  return (
    <div className={`analytics-modal-overlay ${isOpen ? 'open' : 'closed'}`} onClick={onClose}>
      <div className={`analytics-modal-container ${isOpen ? 'open' : 'closed'}`} onClick={e => e.stopPropagation()}>
        <div className="analytics-modal-header">
          <div className="analytics-modal-header-text">
            <h2>{title}</h2>
            {subtitle && <p className="analytics-modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="analytics-close-btn" onClick={onClose} aria-label="Cerrar modal">
            <X size={24} />
          </button>
        </div>
        <div className="analytics-modal-content">
          {children}
        </div>
      </div>
    </div>
  );
}
