import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, loading, error: storeError, setError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(null);

    if (!email.trim() || !password.trim()) {
      setValidationError('Por favor, complete todos los campos.');
      return;
    }

    try {
      await login(email.trim(), password);
      // Success: navigation is handled reactively by Router, 
      // but we force a route push to ensure layout resolves
      navigate('/');
    } catch (err: any) {
      // Errors are already handled in the store
    }
  };

  const activeError = validationError || storeError;

  return (
    <div className="login-page-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-container">
            <img src="/logo_alvacio.png" alt="ALVACÍO" className="login-logo-img" />
          </div>
          <h1 className="login-brand-logo">ALVACÍO</h1>
          <p className="login-brand-subtitle">Plataforma Operativa ERP</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {activeError && (
            <div className="login-error-container">
              <AlertCircle size={20} />
              <span>{activeError}</span>
            </div>
          )}

          <div className="login-field-group">
            <label className="login-field-label">Correo Electrónico</label>
            <div className="login-input-wrapper">
              <Mail className="login-input-icon" size={18} />
              <input
                type="email"
                className="login-input"
                placeholder="ejemplo@alvacio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="login-field-group">
            <label className="login-field-label">Contraseña</label>
            <div className="login-input-wrapper">
              <Lock className="login-input-icon" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? (
              <>
                <div className="login-spinner" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <span>Ingresar</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
