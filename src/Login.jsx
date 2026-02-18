import { useState } from 'react';
import { supabase } from './supabaseClient';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();

    const emailFicticio = `${username}@logistica.com`;

    const { error } = await supabase.auth.signInWithPassword({ 
      email: emailFicticio, 
      password: password 
    });

    if (error) alert("Erro: Usuário ou senha inválidos.");
  };

  return (
    <div className="fullscreen-bg">
      <div className="login-card">
        <h2>📦 Logística Login</h2>
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
          <button type="submit" className="login-button">
            Acessar Sistema
          </button>
        </form>
      </div>
    </div>
  );
}