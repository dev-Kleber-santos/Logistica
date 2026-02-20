import { useState } from 'react';
import { supabase } from './supabaseClient';
import { toast } from 'react-toastify';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const emailFicticio = `${username.trim().toLowerCase()}@logistica.com`;

    const { error } = await supabase.auth.signInWithPassword({ 
      email: emailFicticio, 
      password: password 
    });

    if (error) {
      toast.error("Usuário ou senha inválidos.");
    } else {
      toast.success("Acesso autorizado!");
    }
    setLoading(false);
  };

  return (
    <div className="fullscreen-bg">
      <div className="login-card">
        <h2 className="title-header" style={{ color: '#0d1b2a', marginBottom: '25px', textAlign: 'center' }}>📦 Sistema Logística</h2>
        <form onSubmit={handleLogin} className="login-form">
          <input 
            className="login-input"
            type="text" 
            placeholder="Nome de Usuário" 
            value={username}
            onChange={e => setUsername(e.target.value)} 
            required
          />
          <input 
            className="login-input"
            type="password" 
            placeholder="Senha" 
            value={password}
            onChange={e => setPassword(e.target.value)} 
            required
          />
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}