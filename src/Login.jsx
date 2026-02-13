import { useState } from 'react';
import { supabase } from './supabaseClient';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Erro: " + error.message);
  };

  return (
    <div className="fullscreen-bg">
      <div className="login-card">
        <h2>📦 Logística Login</h2>
        <form onSubmit={handleLogin} className="login-form">
          <input 
            className="login-input"
            type="email" 
            placeholder="E-mail" 
            onChange={e => setEmail(e.target.value)} 
            required
          />
          <input 
            className="login-input"
            type="password" 
            placeholder="Senha" 
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