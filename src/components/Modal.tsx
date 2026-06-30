import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
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

  if (!shouldRender) return null;

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : 'closed'}`} onClick={(e) => {
      console.log("========== CLICK INTERCEPTADO ==========");
      console.log("TARGET", e.target);
      console.log("CURRENT", e.currentTarget);
      console.log("PATH", e.nativeEvent.composedPath());
      console.log("ACTIVE ELEMENT", document.activeElement);
      console.log("TARGET CLASSNAME", (e.target as Element).className);
      console.log("TARGET TAGNAME", (e.target as Element).tagName);
      console.log("CURRENT CLASSNAME", (e.currentTarget as Element).className);

      if (e.target === e.currentTarget) {
        onClose();
      }
    }}>
      <div className={`modal-container ${isOpen ? 'open' : 'closed'}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="modal-content">
          {children}
        </div>
      </div>
    </div>
  );
}
