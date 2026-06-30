import React from 'react';
import { Search } from 'lucide-react';

type MobileSearchBarProps = {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
};

export default function MobileSearchBar({ value, onChange, placeholder = 'Buscar...' }: MobileSearchBarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '0 16px',
      height: '48px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      border: '1px solid var(--mobile-border)',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <Search size={20} color="var(--mobile-text-secondary)" style={{ flexShrink: 0 }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          flex: 1,
          marginLeft: '12px',
          fontSize: '16px',
          color: 'var(--mobile-text-primary)',
          fontFamily: 'inherit'
        }}
      />
    </div>
  );
}
