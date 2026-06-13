import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import './ExpandableCard.css';

interface ExpandableCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  statusBadge?: ReactNode;
  collapsedContent: ReactNode;
  expandedContent: ReactNode;
  actions?: ReactNode;
  defaultExpanded?: boolean;
}

export default function ExpandableCard({
  title,
  subtitle,
  statusBadge,
  collapsedContent,
  expandedContent,
  actions,
  defaultExpanded = false
}: ExpandableCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`expandable-card ${isExpanded ? 'expanded' : ''}`}>
      <div 
        className="ec-header" 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="ec-title-area">
          <div className="ec-title-row">
            <h3 className="ec-title">{title}</h3>
            {statusBadge && <div className="ec-badge">{statusBadge}</div>}
          </div>
          {subtitle && <div className="ec-subtitle">{subtitle}</div>}
        </div>
        <div className="ec-toggle">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>
      
      <div className="ec-collapsed-content" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        {collapsedContent}
      </div>

      <div className={`ec-expanded-content-wrapper ${isExpanded ? 'open' : ''}`}>
        <div className="ec-expanded-inner">
          <div className="ec-divider" />
          {expandedContent}
        </div>
      </div>

      {actions && (
        <div className="ec-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
