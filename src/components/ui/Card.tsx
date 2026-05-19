import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', padding = 'md', style }) => {
  const paddingClass = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }[padding];

  const padStyle = padding === 'none' ? '0' : padding === 'sm' ? '16px' : padding === 'md' ? '24px' : '32px';

  return (
    <div 
      className={`card ${className}`} 
      style={{ padding: padStyle, ...style }}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="card-header">
    <div>
      <h3 className="card-title">{title}</h3>
      {subtitle && <p className="card-subtitle">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);
