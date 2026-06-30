import React from 'react';

type MobileSkeletonProps = {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
};

export default function MobileSkeleton({ width = '100%', height = '20px', borderRadius = '8px', style }: MobileSkeletonProps) {
  return (
    <div 
      style={{
        width, height, borderRadius,
        backgroundColor: '#e5e7eb',
        backgroundImage: 'linear-gradient(90deg, #e5e7eb 0px, #f3f4f6 40px, #e5e7eb 80px)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s infinite linear',
        ...style
      }}
    >
      <style>
        {`
          @keyframes skeleton-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}
      </style>
    </div>
  );
}
