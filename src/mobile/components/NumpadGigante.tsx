import React from 'react';

type NumpadGiganteProps = {
  value: string;
  onChange: (val: string) => void;
  onEnter?: () => void;
  disabled?: boolean;
};

export default function NumpadGigante({ value, onChange, onEnter, disabled = false }: NumpadGiganteProps) {
  const handlePress = (key: string) => {
    if (disabled) return;
    
    // Feedback háptico opcional si lo soporta el dispositivo
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }

    if (key === 'DEL') {
      onChange(value.slice(0, -1));
    } else if (key === 'ENTER') {
      if (onEnter) onEnter();
    } else if (key === '.') {
      if (!value.includes('.')) onChange(value + '.');
    } else {
      if (value === '0') onChange(key);
      else onChange(value + key);
    }
  };

  const padStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    width: '100%',
    maxWidth: '400px',
    margin: '0 auto',
    padding: '16px',
    backgroundColor: 'var(--mobile-surface)',
    borderTop: '1px solid var(--mobile-border)'
  };

  const btnStyle: React.CSSProperties = {
    height: '70px',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: '#f3f4f6',
    fontSize: '28px',
    fontWeight: 600,
    color: 'var(--mobile-text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background-color 0.1s'
  };

  return (
    <div style={padStyle} className="mobile-no-select">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
        <button key={num} style={btnStyle} onClick={() => handlePress(num.toString())}>
          {num}
        </button>
      ))}
      <button style={btnStyle} onClick={() => handlePress('.')}>.</button>
      <button style={btnStyle} onClick={() => handlePress('0')}>0</button>
      <button 
        style={{ ...btnStyle, backgroundColor: '#fee2e2', color: '#ef4444' }} 
        onClick={() => handlePress('DEL')}
      >
        ⌫
      </button>
    </div>
  );
}
