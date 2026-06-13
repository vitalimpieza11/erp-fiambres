import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import './RightPanel.css';

interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function RightPanel({ isOpen, onClose, title, children }: RightPanelProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300); // match transition
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div className={`right-panel ${isOpen ? 'open' : 'closed'}`}>
      <div className="right-panel-header">
        <h2>{title}</h2>
        <button className="close-btn" onClick={onClose} aria-label="Cerrar panel">
          <X size={24} />
        </button>
      </div>
      <div className="right-panel-content">
        {children}
      </div>
    </div>
  );
}
