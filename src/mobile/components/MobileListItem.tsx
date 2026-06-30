import React from 'react';
import { ChevronRight } from 'lucide-react';

type MobileListItemProps = {
  title: string;
  subtitle?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  onClick?: () => void;
  showArrow?: boolean;
};

export default function MobileListItem({ title, subtitle, leftIcon, rightElement, onClick, showArrow = false }: MobileListItemProps) {
  return (
    <div 
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 0',
        borderBottom: '1px solid var(--mobile-border)',
        cursor: onClick ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'rgba(0,0,0,0.05)',
        transition: 'background-color 0.2s ease',
      }}
      className="mobile-no-select"
    >
      {leftIcon && (
        <div style={{ marginRight: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {leftIcon}
        </div>
      )}
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--mobile-text-primary)' }}>{title}</span>
        {subtitle && (
          <span style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)', marginTop: '2px' }}>{subtitle}</span>
        )}
      </div>

      {(rightElement || showArrow) && (
        <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rightElement}
          {showArrow && <ChevronRight size={20} color="#9ca3af" />}
        </div>
      )}
    </div>
  );
}
