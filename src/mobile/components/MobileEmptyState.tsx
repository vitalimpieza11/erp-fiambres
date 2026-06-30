import React from 'react';

type MobileEmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export default function MobileEmptyState({ icon, title, description, action }: MobileEmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', height: '100%' }}>
      <div style={{ color: '#d1d5db', marginBottom: '16px' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--mobile-text-primary)', margin: '0 0 8px 0' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)', margin: '0 0 24px 0', maxWidth: '280px', lineHeight: 1.4 }}>
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
