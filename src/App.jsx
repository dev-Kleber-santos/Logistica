import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import './index.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPenToSquare, faTrash, faFileExcel, faUsers, faBoxesStacked, faFilePdf, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons'
import * as XLSX from 'xlsx'

function App() {
  const [session, setSession] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [busca, setBusca] = useState('')
  const [abaAtual, setAbaAtual] = useState('estoque')

  /* Estados dos inputs do formulário */
  const [nome, setNome] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [lote, setLote] = useState('')
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')

  /* Estados de Controle de Acesso e Histórico */
  const [perfil, setPerfil] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [historico, setHistorico] = useState([])

  const [editandoId, setEditandoId] = useState(null)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  /* Estados para o Modal de Exclusão com Máscara */
  const [showModalExcluir, setShowModalExcluir] = useState(false);
  const [senhaExcluir, setSenhaExcluir] = useState('');
  const [itemParaExcluir, setItemParaExcluir] = useState(null);

  /* MONITORAMENTO DE SESSÃO */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchPerfil(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchPerfil(session.user.id)
      else { setPerfil(null); setUsuarios([]); setHistorico([]); }
    })
    return () => subscription.unsubscribe()
  }, [])

  /* BUSCA DE PERFIL E DADOS ADMINISTRATIVOS */
  const fetchPerfil = async (userId) => {
    const { data } = await supabase
      .from('perfis')
      .select('username, role')
      .eq('id', userId)
      .single()

    if (data) {
      setPerfil(data.role)
      if (data.role === 'gerente') {
        fetchUsuarios();
        fetchHistorico();
      }
    }
  }

  const fetchUsuarios = async () => {
    const { data, error } = await supabase.from('perfis').select('id, username, role')
    if (!error) setUsuarios(data)
  }

  /* BUSCA O HISTÓRICO PERMANENTE (Itens que já foram "excluídos") */
  const fetchHistorico = async () => {
    const { data, error } = await supabase
      .from('historico_exclusao')
      .select('*')
      .order('data_exclusao', { ascending: false })
    if (!error) setHistorico(data)
  }

  /* BUSCA PRODUTOS ATIVOS (Filtra o que não foi desativado) */
  const fetchProdutos = async () => {
    const { data, error } = await supabase
      .from('produtos')
      .select(`*, perfis:criado_por (username)`)
      .eq('ativo', true) // <-- ESSENCIAL: Só traz o que não foi excluído
      .order('created_at', { ascending: false })
    if (!error) setProdutos(data)
  }

  useEffect(() => { if (session) fetchProdutos() }, [session])

  /* CADASTRO E EDIÇÃO */
  const handleAddProduto = async (e) => {
    e.preventDefault();
    const payload = {
      nome,
      quantidade: parseInt(quantidade),
      categoria,
      lote,
      marca,
      criado_por: session.user.id,
      ativo: true
    };

    if (editandoId) {
      const { data, error } = await supabase
        .from('produtos')
        .update(payload)
        .eq('id', editandoId)
        .select(`*, perfis:criado_por (username)`);
      if (!error) {
        setProdutos(produtos.map(p => p.id === editandoId ? data[0] : p));
        setEditandoId(null);
      }
    } else {
      const { data, error } = await supabase
        .from('produtos')
        .insert([payload])
        .select(`*, perfis:criado_por (username)`);
      if (data) setProdutos(prev => [data[0], ...prev]);
    }
    setNome(''); setQuantidade(''); setCategoria(''); setLote(''); setMarca('');
  };

  /* LÓGICA DE EXCLUSÃO SEGURA */
  const fecharModal = () => {
    setShowModalExcluir(false);
    setSenhaExcluir('');
    setItemParaExcluir(null);
  };

  const processarExclusao = async () => {
    const SENHA_MESTRA = "1234"; // Defina sua senha de gerente aqui

    if (senhaExcluir === SENHA_MESTRA) {
      // 1. Grava no Histórico Permanente (Auditoria)
      const { error: errorHistorico } = await supabase
        .from('historico_exclusao')
        .insert([{
          nome_item: itemParaExcluir.nome,
          quantidade: itemParaExcluir.quantidade,
          usuario_que_excluiu: session.user.email.split('@')[0].toUpperCase()
        }]);

      if (errorHistorico) {
        alert("Erro ao registrar log de auditoria.");
        return;
      }

      // 2. Desativa o item no banco (Soft Delete)
      const { error } = await supabase
        .from('produtos')
        .update({ ativo: false })
        .eq('id', itemParaExcluir.id);

      if (!error) {
        // Atualiza a lista local removendo o item da visão
        setProdutos(prev => prev.filter(p => p.id !== itemParaExcluir.id));
        fetchHistorico(); // Atualiza a aba de histórico
        fecharModal();
        alert("Item arquivado com sucesso!");
      }
    } else {
      alert("Senha incorreta!");
    }
  };

  /* RELATÓRIOS */
  const gerarPDF = () => { window.print(); };

  const exportarExcel = () => {
    const dadosParaExcel = produtosFiltrados.map(p => ({
      Produto: p.nome.toUpperCase(),
      Quantidade: p.quantidade,
      Marca: p.marca.toUpperCase(),
      Lote: p.lote,
      Categoria: p.categoria.toUpperCase(),
      Cadastrado_Por: p.perfis?.username?.toUpperCase() || 'SISTEMA',
      Data_Entrada: p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '---'
    }));
    const planilha = XLSX.utils.json_to_sheet(dadosParaExcel);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Estoque");
    XLSX.writeFile(livro, "Relatorio_Estoque.xlsx");
  };

  /* FILTROS DE BUSCA E DATA */
  const produtosFiltrados = produtos.filter(p => {
    const dataItem = p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : '';
    const matchesBusca = p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.categoria.toLowerCase().includes(busca.toLowerCase()) ||
      p.marca.toLowerCase().includes(busca.toLowerCase());
    const matchesData = (!dataInicio || dataItem >= dataInicio) &&
      (!dataFim || dataItem <= dataFim);
    return matchesBusca && matchesData;
  });

  if (!session) return <Login />

  return (
    <div className="app-container">
      <div className="content-card">
        <header className="app-header">
          <div className='info-usuario'>
            <h2 className="title">📦 Gestão de Logística</h2>
            <span className='usuario'>
                Olá, <b>{session.user.email.split('@')[0].toUpperCase()}</b> ({perfil || 'Carregando...'})
            </span>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="btn-logout no-print">Sair</button>
        </header>

        {/* NAVEGAÇÃO POR ABAS */}
        {perfil === 'gerente' && (
          <div className="admin-tabs no-print">
            <button className={abaAtual === 'estoque' ? 'tab-active' : ''} onClick={() => setAbaAtual('estoque')}>
              <FontAwesomeIcon icon={faBoxesStacked} /> Estoque
            </button>
            <button className={abaAtual === 'usuarios' ? 'tab-active' : ''} onClick={() => setAbaAtual('usuarios')}>
              <FontAwesomeIcon icon={faUsers} /> Usuários
            </button>
            <button className={abaAtual === 'historico' ? 'tab-active' : ''} onClick={() => setAbaAtual('historico')}>
              <FontAwesomeIcon icon={faClockRotateLeft} /> Histórico
            </button>
          </div>
        )}

        {/* VISÃO PRINCIPAL: ESTOQUE */}
        {abaAtual === 'estoque' ? (
          <>
            <div className="dashboard-cards no-print">
              <div className="card-kpi">
                <span className="card-title">Total de Peças</span>
                <span className="card-value">
                  {produtos.reduce((acc, p) => acc + (p.quantidade || 0), 0)}
                </span>
              </div>
              <div className="card-kpi alert">
                <span className="card-title">Estoque Baixo</span>
                <span className="card-value">
                  {produtos.filter(p => p.quantidade < 5).length}
                </span>
              </div>
              <div className="card-kpi info">
                <span className="card-title">Categorias</span>
                <span className="card-value">
                  {new Set(produtos.map(p => p.categoria)).size}
                </span>
              </div>
            </div>

            <form onSubmit={handleAddProduto} className="form-grid no-print">
              <input className="input-field" placeholder="Produto" value={nome} onChange={e => setNome(e.target.value)} required />
              <input className="input-field" type="number" placeholder="Qtd" value={quantidade} onChange={e => setQuantidade(e.target.value)} required />
              <input className='input-field' placeholder='Marca' value={marca} onChange={e => setMarca(e.target.value)} required />
              <input className='input-field' placeholder='Lote' value={lote} onChange={e => setLote(e.target.value)} required />
              <input className="input-field" placeholder="Categoria" value={categoria} onChange={e => setCategoria(e.target.value)} required />
              <button type="submit" className={editandoId ? "btn-edit-save" : "btn-add"}>
                {editandoId ? "Salvar" : "Adicionar"}
              </button>
            </form>

            {perfil === 'gerente' && (
              <div className="report-filters no-print">
                <div className="date-group">
                  <label>De: <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></label>
                  <label>Até: <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></label>
                </div>
                <div className="search-group">
                  <input className="search-field" placeholder="🔍 Pesquisar no estoque..." value={busca} onChange={e => setBusca(e.target.value)} />
                  <button onClick={gerarPDF} className="btn-report">
                    <FontAwesomeIcon icon={faFilePdf} style={{ marginRight: '8px' }} /> PDF
                  </button>
                  <button onClick={exportarExcel} className="btn-excel">
                    <FontAwesomeIcon icon={faFileExcel} style={{ marginRight: '8px' }} /> Excel
                  </button>
                </div>
              </div>
            )}

            <table className="data-table">
              <thead className="table-head">
                <tr>
                  <th>Item</th>
                  <th>Qtd</th>
                  <th>Marca</th>
                  <th>Lote</th>
                  <th>Categoria</th>
                  <th>Entrada</th>
                  {perfil === 'gerente' && <th>Cadastrado por</th>}
                  <th className="no-print">Ação</th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map(p => (
                  <tr key={p.id} className="table-row">
                    <td>{p.nome.toUpperCase()}</td>
                    <td>{p.quantidade}</td>
                    <td>{p.marca.toUpperCase()}</td>
                    <td>{p.lote}</td>
                    <td><span className="badge-category">{p.categoria.toUpperCase()}</span></td>
                    <td>{p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '---'}</td>
                    {perfil === 'gerente' && <td style={{ fontSize: '14px', color: '#555' }}>{p.perfis?.username?.toUpperCase() || 'SISTEMA'}</td>}
                    <td className="no-print">
                      <div className="actions-cell">
                        <button onClick={() => { setEditandoId(p.id); setNome(p.nome); setQuantidade(p.quantidade); setMarca(p.marca); setLote(p.lote); setCategoria(p.categoria); }} className="btn-edit" title="Editar"><FontAwesomeIcon icon={faPenToSquare} /></button>
                        {perfil === 'gerente' && (
                          <button onClick={() => { setItemParaExcluir(p); setShowModalExcluir(true); }} className="btn-delete" title="Excluir">
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : abaAtual === 'usuarios' ? (
          /* ABA DE USUÁRIOS */
          <div className="user-management">
            <h3>👥 Usuários Cadastrados no Sistema</h3>
            <table className="data-table">
              <thead className="table-head">
                <tr><th>Nome</th><th>Cargo</th></tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} className="table-row">
                    <td>{u.username?.toUpperCase() || 'SEM NOME'}</td>
                    <td><span className="badge-category">{u.role.toUpperCase()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ABA DE HISTÓRICO PERMANENTE */
          <div className="history-management">
            <h3>📜 Histórico Permanente de Exclusões</h3>
            <table className="data-table">
              <thead className="table-head">
                <tr>
                  <th>Item Removido</th>
                  <th>Qtd Original</th>
                  <th>Excluído por</th>
                  <th>Data da Exclusão</th>
                </tr>
              </thead>
              <tbody>
                {historico.map(h => (
                  <tr key={h.id} className="table-row">
                    <td>{h.nome_item.toUpperCase()}</td>
                    <td>{h.quantidade}</td>
                    <td>{h.usuario_que_excluiu}</td>
                    <td>{new Date(h.data_exclusao).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MODAL DE SEGURANÇA PARA EXCLUSÃO (Com máscara de senha) */}
        {showModalExcluir && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Confirmar Exclusão</h3>
              <p>Você está removendo: <b>{itemParaExcluir?.nome.toUpperCase()}</b></p>
              <input 
                type="password" 
                placeholder="Senha Master" 
                value={senhaExcluir}
                onChange={(e) => setSenhaExcluir(e.target.value)}
                className="input-field"
                autoFocus
              />
              <div className="modal-actions">
                <button onClick={fecharModal} className="btn-cancel">Cancelar</button>
                <button onClick={processarExclusao} className="btn-delete">Confirmar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App