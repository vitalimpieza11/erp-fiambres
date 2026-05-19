import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertTriangle, Loader2 } from 'lucide-react';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
    } catch (err: any) {
      setError('Credenciales incorrectas o error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F8F9FA',
      padding: '24px',
      fontFamily: 'var(--font-body)',
      position: 'relative',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        zIndex: 10
      }}>
        {/* Logo and Brand Header - Image principal */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <img 
            src="/logo_principal.png" 
            alt="Al Vacío Logo" 
            style={{ width: '360px', height: 'auto', marginBottom: '20px', objectFit: 'contain' }} 
          />
          <p style={{
            fontSize: '0.825rem',
            color: '#495057',
            marginTop: '8px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-title)'
          }}>
            Gestión de Alimentos Envasados
          </p>
        </div>

        {/* Login Form Box - Clean White */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #DEE2E6',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(33, 37, 41, 0.04)',
          padding: '40px'
        }}>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} onSubmit={handleSubmit}>
            {error && (
              <div style={{
                backgroundColor: 'rgba(230, 57, 70, 0.08)',
                border: '1px solid rgba(230, 57, 70, 0.2)',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#E63946',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.85rem',
                fontWeight: 500
              }}>
                <AlertTriangle size={18} style={{ color: '#E63946', flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#212529',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-title)'
              }}>
                Correo Electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{
                  position: 'absolute',
                  left: '14px',
                  top: '14px',
                  color: '#495057'
                }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    borderRadius: '8px',
                    border: '1px solid #DEE2E6',
                    backgroundColor: '#FFFFFF',
                    color: '#212529',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  placeholder="admin@alvacio.com"
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary-color)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(230, 57, 70, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#DEE2E6';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#212529',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-title)'
              }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{
                  position: 'absolute',
                  left: '14px',
                  top: '14px',
                  color: '#495057'
                }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    borderRadius: '8px',
                    border: '1px solid #DEE2E6',
                    backgroundColor: '#FFFFFF',
                    color: '#212529',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  placeholder="••••••••"
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary-color)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(230, 57, 70, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#DEE2E6';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--primary-color)',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(230, 57, 70, 0.15)',
                marginTop: '8px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-color)'}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                'Ingresar al Sistema'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
