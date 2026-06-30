import React from 'react';

type MobileBadgeProps = {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
};

export default function MobileBadge({ children, variant = 'default' }: MobileBadgeProps) {
  const getColors = () => {
    switch (variant) {
      case 'success': return { bg: '#d1fae5', color: '#047857' }; // Emerald
      case 'warning': return { bg: '#fef3c7', color: '#b45309' }; // Amber
      case 'error': return { bg: '#fee2e2', color: '#b91c1c' }; // Red
      case 'info': return { bg: '#dbeafe', color: '#1d4ed8' }; // Blue
      default: return { bg: '#f3f4f6', color: '#374151' }; // Gray
    }
  };

  const { bg, color } = getColors();

  return (
    <span style={{
      backgroundColor: bg,
      color: color,
      padding: '4px 8px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      textTransform: 'uppercase'
    }}>
      {children}
    </span>
  );
}
