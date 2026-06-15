import React from 'react';

interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (status: 'all' | 'active' | 'inactive') => void;
}

export default function FilterBar({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  statusFilter,
  onStatusFilterChange
}: FilterBarProps) {
  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
      <input 
        type="text" 
        placeholder={searchPlaceholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{ flex: 1, minWidth: '280px', maxWidth: '400px' }}
      />

      <div style={{ display: 'flex', gap: '4px', background: '#e5e7eb', padding: '4px', borderRadius: '12px' }}>
        <button 
          type="button" 
          onClick={() => onStatusFilterChange('active')}
          style={{
            padding: '8px 16px', fontSize: '13px', borderRadius: '10px',
            backgroundColor: statusFilter === 'active' ? '#fff' : 'transparent',
            color: statusFilter === 'active' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: statusFilter === 'active' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          Activos
        </button>
        <button 
          type="button" 
          onClick={() => onStatusFilterChange('inactive')}
          style={{
            padding: '8px 16px', fontSize: '13px', borderRadius: '10px',
            backgroundColor: statusFilter === 'inactive' ? '#fff' : 'transparent',
            color: statusFilter === 'inactive' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: statusFilter === 'inactive' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          Inactivos
        </button>
        <button 
          type="button" 
          onClick={() => onStatusFilterChange('all')}
          style={{
            padding: '8px 16px', fontSize: '13px', borderRadius: '10px',
            backgroundColor: statusFilter === 'all' ? '#fff' : 'transparent',
            color: statusFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: statusFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          Todos
        </button>
      </div>
    </div>
  );
}
