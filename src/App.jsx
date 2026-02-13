import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import './index.css'

function App() {
  const [session, setSession] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [busca, setBusca] = useState('')
  
  const [nome, setNome] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [categoria, setCategoria] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  const fetchProdutos = async () => {
    const { data, error } = await supabase.from('produtos').select('*')
    if (error) console.log('Erro:', error)
    else setProdutos(data)
  }

  useEffect(() => { if (session) fetchProdutos() }, [session])

  const handleAddProduto = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('produtos')
      .insert([{ nome, quantidade: parseInt(quantidade), categoria }])
      .select(); 

    if (error) alert("Erro: " + error.message);
    else if (data) {
      setProdutos(prev => [...prev, data[0]]);
      setNome(''); setQuantidade(''); setCategoria('');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Excluir item?")) {
      const { error } = await supabase.from('produtos').delete().eq('id', id)
      if (error) alert(error.message)
      else setProdutos(produtos.filter(p => p.id !== id))
    }
  }

  const produtosFiltrados = produtos.filter(p => 
    p.nome.toLowerCase().includes(busca.toLowerCase()) || 
    p.categoria.toLowerCase().includes(busca.toLowerCase())
  )

  if (!session) return <Login />

  return (
    <div className="app-container">
      <div className="content-card">
        <header className="app-header">
          <h2 className="title">📦 Gestão de Logística</h2>
          <button onClick={() => supabase.auth.signOut()} className="btn-logout">Sair</button>
        </header>

        <form onSubmit={handleAddProduto} className="form-grid">
          <input className="input-field" placeholder="Produto" value={nome} onChange={e => setNome(e.target.value)} required />
          <input className="input-field" type="number" placeholder="Qtd" value={quantidade} onChange={e => setQuantidade(e.target.value)} required />
          <input className="input-field" placeholder="Categoria" value={categoria} onChange={e => setCategoria(e.target.value)} required />
          <button type="submit" className="btn-add">Adicionar</button>
        </form>

        <input 
          className="search-field"
          placeholder="🔍 Pesquisar no estoque..." 
          value={busca} 
          onChange={e => setBusca(e.target.value)} 
        />

        <table className="data-table">
          <thead className="table-head">
            <tr>
              <th>Item</th>
              <th>Qtd</th>
              <th>Categoria</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {produtosFiltrados.map(p => (
              <tr key={p.id} className="table-row">
                <td>{p.nome}</td>
                <td>{p.quantidade}</td>
                <td><span className="badge-category">{p.categoria}</span></td>
                <td>
                  <button onClick={() => handleDelete(p.id)} className="btn-delete">Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default App