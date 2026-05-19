import React from 'react';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description }) => {
  return (
    <div className="empty-state">
      <div className="empty-icon-wrapper">
        <Icon size={32} />
      </div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-description">{description}</p>
    </div>
  );
};

export const PageHeader = ({ title, description }: { title: string, description: string }) => (
  <div className="page-header">
    <h1 className="page-title">{title}</h1>
    <p className="page-description">{description}</p>
  </div>
);
