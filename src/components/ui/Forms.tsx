import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, icon, className = '', ...props }) => {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="form-input-wrapper">
        {icon && (
          <div className="form-input-icon">
            {icon}
          </div>
        )}
        <input 
          className={`form-input ${icon ? 'has-icon' : ''} ${className}`}
          {...props} 
        />
      </div>
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string, label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <select 
        className={`form-select ${className}`}
        {...props}
      >
        <option value="" disabled>Seleccione una opción</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          backgroundColor: checked ? 'var(--primary-color)' : 'var(--border-color)',
          position: 'relative',
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color var(--transition-fast)'
        }}
      >
        <div style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          position: 'absolute',
          top: '3px',
          left: checked ? '23px' : '3px',
          transition: 'left var(--transition-fast)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
      </button>
    </div>
  );
};
