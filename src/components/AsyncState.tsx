import React from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from './ui/Card';

interface LoadingSpinnerProps {
  message?: string;
  height?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Cargando datos...', 
  height = '300px' 
}) => {
  return (
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height, 
        width: '100%',
        gap: '16px',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <div 
        style={{ 
          position: 'relative', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}
      >
        {/* Outer glowing pulsing circle */}
        <div 
          style={{ 
            position: 'absolute', 
            width: '48px', 
            height: '48px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--primary-light)', 
            opacity: 0.5,
            animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' 
          }} 
        />
        {/* Actual Spinner */}
        <Loader2 
          size={36} 
          color="var(--primary-color)" 
          style={{ 
            animation: 'spin 1s linear infinite', 
            zIndex: 1 
          }} 
        />
      </div>
      <span 
        style={{ 
          fontSize: '0.925rem', 
          color: 'var(--text-secondary)', 
          fontWeight: 500,
          letterSpacing: '0.025em'
        }}
      >
        {message}
      </span>
      
      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

interface ErrorStateProps {
  message?: any;
  onRetry?: () => void;
  height?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  message = 'Ocurrió un error al cargar la información.', 
  onRetry,
  height = '300px'
}) => {
  const displayMessage = typeof message === 'object' && message !== null
    ? (message.message || JSON.stringify(message))
    : String(message || 'Ocurrió un error al cargar la información.');

  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height, 
        width: '100%',
        padding: '24px',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <Card style={{ maxWidth: '480px', width: '100%', borderLeft: '4px solid var(--danger-color)', padding: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div 
            style={{ 
              backgroundColor: '#fee2e2', 
              color: '#dc2626', 
              padding: '10px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <AlertCircle size={24} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Error de Conexión
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {displayMessage}
            </p>
            {onRetry && (
              <button 
                onClick={onRetry} 
                className="btn btn-primary" 
                style={{ 
                  alignSelf: 'flex-start', 
                  marginTop: '12px', 
                  padding: '8px 16px', 
                  fontSize: '0.85rem',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} />
                Reintentar
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

interface SkeletonLoaderProps {
  rows?: number;
  height?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  rows = 4,
  height = '48px'
}) => {
  return (
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px', 
        width: '100%', 
        padding: '20px',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div 
          key={i} 
          style={{ 
            height, 
            width: '100%', 
            borderRadius: '8px', 
            background: 'linear-gradient(90deg, #f1f3f5 25%, #e9ecef 50%, #f1f3f5 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite linear' 
          }} 
        />
      ))}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
};
