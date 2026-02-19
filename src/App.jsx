import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import './index.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPenToSquare, faTrash, faUsers, faBoxesStacked, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons'

function App() {
  const [session, setSession] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [abaAtual, setAbaAtual] = useState('estoque')
  const [filtroEstoqueBaixo, setFiltroEstoqueBaixo] = useState(false)
  const [perfil, setPerfil] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [historico, setHistorico] = useState([])

  const [nome, setNome] = useState(''); const [quantidade, setQuantidade] = useState('');
  const [marca, setMarca] = useState(''); const [lote, setLote] = useState('');
  const [categoria, setCategoria] = useState(''); const [sku, setSku] = useState('');
  const [ncm, setNcm] = useState(''); const [cest, setCest] = useState('');
  const [valorCusto, setValorCusto] = useState(''); const [valorVenda, setValorVenda] = useState('');

  const [editandoId, setEditandoId] = useState(null)
  const [showModalExcluir, setShowModalExcluir] = useState(false)
  const [senhaExcluir, setSenhaExcluir] = useState('')
  const [itemParaExcluir, setItemParaExcluir] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); if (session) fetchPerfil(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session); if (session) fetchPerfil(session.user.id)
      else { setPerfil(null); setUsuarios([]); setHistorico([]); }
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchPerfil = async (userId) => {
    const { data } = await supabase.from('perfis').select('username, role').eq('id', userId).single()
    if (data) {
      setPerfil(data.role)
      if (data.role === 'gerente') { fetchUsuarios(); fetchHistorico(); }
    }
  }

  const fetchUsuarios = async () => {
    const { data } = await supabase.from('perfis').select('id, username, role')
    if (data) setUsuarios(data)
  }

  const fetchHistorico = async () => {
    const { data } = await supabase.from('historico_exclusao').select('*').order('data_exclusao', { ascending: false })
    if (data) setHistorico(data)
  }

  const fetchProdutos = async () => {
    // Buscamos sem filtros restritivos para garantir a sincronia com o banco
    const { data, error } = await supabase
      .from('produtos')
      .select('*, perfis:created_by (username)')
      .order('created_at', { ascending: false });

    if (!error) {
      setProdutos(data || []);
      console.log("Sincronizado: ", data.length, " itens carregados.");
    }
  }

  useEffect(() => { if (session) fetchProdutos() }, [session])

  const handleAddProduto = async (e) => {
    e.preventDefault()
    const payload = {
      nome, quantidade: parseInt(quantidade), categoria, lote, marca,
      sku, ncm, cest, valor_custo: parseFloat(valorCusto || 0), valor_venda: parseFloat(valorVenda || 0),
      created_by: session.user.id, ativo: true
    }
    try {
      if (editandoId) {
        await supabase.from('produtos').update(payload).eq('id', editandoId)
      } else {
        await supabase.from('produtos').insert([payload])
      }
      limparCampos(); fetchProdutos(); alert("Salvo com sucesso!")
    } catch (error) { alert(error.message) }
  }

  const limparCampos = () => {
    setNome(''); setQuantidade(''); setMarca(''); setLote(''); setCategoria('')
    setSku(''); setNcm(''); setCest(''); setValorCusto(''); setValorVenda(''); setEditandoId(null)
  }

  const processarExclusao = async () => {
    if (senhaExcluir === "1234") {
      await supabase.from('historico_exclusao').insert([{ nome_item: itemParaExcluir.nome, quantidade: itemParaExcluir.quantidade, usuario_que_excluiu: session.user.email.split('@')[0].toUpperCase() }])
      // Marcamos como falso no banco
      await supabase.from('produtos').update({ ativo: false }).eq('id', itemParaExcluir.id)

      // Atualizamos a lista local para sumir na hora
      setProdutos(prev => prev.filter(p => p.id !== itemParaExcluir.id))
      fecharModal(); fetchHistorico();
    } else { alert("Senha incorreta!") }
  }

  const fecharModal = () => { setShowModalExcluir(false); setSenhaExcluir(''); setItemParaExcluir(null) }

  if (!session) return <Login />

  return (
    <div className="app-wrapper">
      <header className="app-header no-print">
        <div className="header-left">
          <h2 className="title-header">Logística</h2>
          {perfil === 'gerente' && (
            <nav className="admin-tabs">
              <button className={abaAtual === 'estoque' ? 'tab-active' : ''} onClick={() => setAbaAtual('estoque')}><FontAwesomeIcon icon={faBoxesStacked} /> Estoque</button>
              <button className={abaAtual === 'usuarios' ? 'tab-active' : ''} onClick={() => setAbaAtual('usuarios')}><FontAwesomeIcon icon={faUsers} /> Usuários</button>
              <button className={abaAtual === 'historico' ? 'tab-active' : ''} onClick={() => setAbaAtual('historico')}><FontAwesomeIcon icon={faClockRotateLeft} /> Histórico</button>
            </nav>
          )}
        </div>
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ color: 'white' }}>Olá, <b>{session.user.email.split('@')[0].toUpperCase()}</b></span>
          <button onClick={() => supabase.auth.signOut()} className="btn-logout">Sair</button>
        </div>
      </header>

      <main className="app-container">
        <div className="content-card">
          {abaAtual === 'estoque' ? (
            <>
              <div className="dashboard-cards">
                <div className="card-kpi"><span className="card-title">Total</span><span className="card-value">{produtos.filter(p => p.ativo !== false).length}</span></div>
                <div className="card-kpi alert" onClick={() => setFiltroEstoqueBaixo(!filtroEstoqueBaixo)} style={{ cursor: 'pointer' }}>
                  <span className="card-title">Estoque Baixo</span>
                  <span className="card-value" style={{ color: '#ff4d4d' }}>{produtos.filter(p => p.ativo !== false && p.quantidade < 5).length}</span>
                </div>
              </div>

              <form onSubmit={handleAddProduto} className="form-grid no-print">
                <div className="input-group"><label>Produto</label><input className="input-field" value={nome} onChange={e => setNome(e.target.value)} required /></div>
                <div className="input-group"><label>Qtd</label><input className="input-field" type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} required /></div>
                <div className="input-group"><label>SKU</label><input className="input-field" value={sku} onChange={e => setSku(e.target.value)} /></div>
                <div className="input-group"><label>Marca</label><input className="input-field" value={marca} onChange={e => setMarca(e.target.value)} /></div>
                <div className="input-group"><label>NCM</label><input className="input-field" value={ncm} onChange={e => setNcm(e.target.value)} /></div>
                <div className="input-group"><label>CEST</label><input className="input-field" value={cest} onChange={e => setCest(e.target.value)} /></div>
                <div className="input-group"><label>Custo</label><input className="input-field" type="number" value={valorCusto} onChange={e => setValorCusto(e.target.value)} /></div>
                <div className="input-group"><label>Venda</label><input className="input-field" type="number" value={valorVenda} onChange={e => setValorVenda(e.target.value)} /></div>
                <button type="submit" className="btn-add">{editandoId ? "Salvar Alteração" : "Adicionar Item"}</button>
              </form>

              <table className="data-table">
                <thead><tr><th>SKU</th><th>Item</th><th>Qtd</th><th>Custo</th><th>Venda</th><th>Autor</th><th>Ação</th></tr></thead>
                <tbody>
                  {produtos
                    .filter(p => p.ativo !== false) // Filtro de inativos feito no React para não errar
                    .filter(p => (filtroEstoqueBaixo ? p.quantidade < 5 : true))
                    .map(p => (
                      <tr key={p.id} className="table-row">
                        <td style={{ fontSize: '11px' }}>{p.sku || '-'}</td>
                        <td>{p.nome?.toUpperCase()}</td>
                        <td className={p.quantidade < 5 ? 'text-danger' : ''}>{p.quantidade}</td>
                        <td>R$ {p.valor_custo || 0}</td>
                        <td style={{ color: '#2e7d32', fontWeight: 'bold' }}>R$ {p.valor_venda || 0}</td>
                        <td><span className="user-badge">{p.perfis?.username || 'SISTEMA'}</span></td>
                        <td>
                          <button onClick={() => { setEditandoId(p.id); setNome(p.nome); setQuantidade(p.quantidade); setSku(p.sku); setNcm(p.ncm); setCest(p.cest); setValorCusto(p.valor_custo); setValorVenda(p.valor_venda); setMarca(p.marca); setLote(p.lote); setCategoria(p.categoria); }} style={{ marginRight: '10px', background: 'none', border: 'none', cursor: 'pointer' }}><FontAwesomeIcon icon={faPenToSquare} color="#1a73e8" /></button>
                          {perfil === 'gerente' && <button onClick={() => { setItemParaExcluir(p); setShowModalExcluir(true); }} className="btn-delete"><FontAwesomeIcon icon={faTrash} /></button>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          ) : abaAtual === 'historico' ? (
            <div className="user-management">
              <h3>📜 Histórico de Exclusões</h3>
              <table className="data-table">
                <thead><tr><th>Item</th><th>Qtd</th><th>Usuário</th><th>Data</th></tr></thead>
                <tbody>{historico.map(h => (<tr key={h.id}><td>{h.nome_item?.toUpperCase()}</td><td>{h.quantidade}</td><td>{h.usuario_que_excluiu}</td><td>{new Date(h.data_exclusao).toLocaleString('pt-BR')}</td></tr>))}</tbody>
              </table>
            </div>
          ) : (
            <div className="user-management">
              <h3>👥 Usuários do Sistema</h3>
              <table className="data-table">
                <thead><tr><th>Nome</th><th>Cargo</th></tr></thead>
                <tbody>{usuarios.map(u => (<tr key={u.id}><td>{u.username?.toUpperCase()}</td><td>{u.role.toUpperCase()}</td></tr>))}</tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showModalExcluir && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Excluir Item?</h3>
            <input type="password" value={senhaExcluir} onChange={(e) => setSenhaExcluir(e.target.value)} className="input-field" placeholder="Senha Master" autoFocus />
            <div className="modal-actions">
              <button onClick={fecharModal} style={{ background: '#eee', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={processarExclusao} style={{ background: '#ff4d4d', color: 'white', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App