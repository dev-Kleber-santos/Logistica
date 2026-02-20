import { useState, useEffect } from 'react'
import { supabase, supabaseAdmin } from './supabaseClient'
import Login from './Login'
import './index.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPenToSquare, faCartArrowDown, faUsers, faBoxesStacked, faChartLine, faSearch, faFilePdf, faHistory, faPlusCircle, faBarcode, faTimes, faUserPlus, faKey, faUserCircle } from '@fortawesome/free-solid-svg-icons'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Html5QrcodeScanner } from "html5-qrcode"

function App() {
  const [session, setSession] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [abaAtual, setAbaAtual] = useState('estoque')
  const [perfil, setPerfil] = useState(null)
  const [userNameLogado, setUserNameLogado] = useState('') 
  const [usuarios, setUsuarios] = useState([])
  const [vendas, setVendas] = useState([])
  const [logs, setLogs] = useState([])
  const [pesquisa, setPesquisa] = useState('')
  const [mesFiltro, setMesFiltro] = useState('')
  const [filtroEstoqueBaixo, setFiltroEstoqueBaixo] = useState(false)
  const [scannerAtivo, setScannerAtivo] = useState(false)

  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novoUsername, setNovoUsername] = useState('')
  const [novoRole, setNovoRole] = useState('vendedor')

  const [nome, setNome] = useState(''); const [quantidade, setQuantidade] = useState('');
  const [marca, setMarca] = useState(''); const [sku, setSku] = useState('');
  const [ncm, setNcm] = useState(''); const [cest, setCest] = useState('');
  const [valorCusto, setValorCusto] = useState(''); const [valorVenda, setValorVenda] = useState('');

  const [editandoId, setEditandoId] = useState(null)
  const [showModalBaixa, setShowModalBaixa] = useState(false)
  const [showModalEntrada, setShowModalEntrada] = useState(false)
  const [itemSelecionado, setItemSelecionado] = useState(null)
  const [qtdMovimentacao, setQtdMovimentacao] = useState(1)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        fetchPerfil(session.user.id)
      } else {
        setSession(null)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchPerfil(session.user.id)
      else setUserNameLogado('')
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchPerfil = async (userId) => {
    const { data } = await supabase.from('perfis').select('username, role').eq('id', userId).single()
    if (data) {
      setPerfil(data.role)
      setUserNameLogado(data.username) 
      fetchUsuarios(); fetchVendas(); fetchLogs();
    }
  }

  const fetchUsuarios = async () => {
    const { data } = await supabase.from('perfis').select('id, username, role')
    if (data) setUsuarios(data)
  }

  const fetchVendas = async () => {
    const { data } = await supabase.from('vendas').select('*').order('data_exclusao', { ascending: false })
    if (data) setVendas(data)
  }

  const fetchLogs = async () => {
    const { data } = await supabase.from('logs_auditoria').select('*').order('created_at', { ascending: false }).limit(50)
    if (data) setLogs(data)
  }

  const fetchProdutos = async () => {
    const { data, error } = await supabase.from('produtos').select('*, perfis:criado_por (username)').eq('ativo', true).order('nome', { ascending: true });
    if (!error) setProdutos(data || []);
  }

  useEffect(() => { if (session) fetchProdutos() }, [session])

  const handleCriarUsuario = async (e) => {
    e.preventDefault();
    const loadingToast = toast.loading("Cadastrando...");
    try {
      const { data, error: authError } = await supabaseAdmin.auth.signUp({
        email: novoEmail,
        password: novaSenha,
        options: { data: { username: novoUsername.toUpperCase() } }
      });
      if (authError) throw authError;
      if (data.user) {
        await supabase.from('perfis').insert([{ id: data.user.id, username: novoUsername.toUpperCase(), role: novoRole }]);
        toast.update(loadingToast, { render: "Colaborador criado!", type: "success", isLoading: false, autoClose: 3000 });
        setNovoEmail(''); setNovaSenha(''); setNovoUsername('');
        fetchUsuarios();
      }
    } catch (error) {
      toast.update(loadingToast, { render: error.message, type: "error", isLoading: false, autoClose: 3000 });
    }
  };

  const handleResetSenhaFuncionario = async (username) => {
    const emailReal = prompt(`E-mail real de ${username}:`);
    if (!emailReal) return;
    const { error } = await supabase.auth.resetPasswordForEmail(emailReal, { redirectTo: window.location.origin });
    if (error) toast.error(error.message);
    else toast.success("Reset enviado!");
  };

  const registrarLog = async (acao, itemNome, detalhes) => {
    try {
      await supabase.from('logs_auditoria').insert([{
        usuario: userNameLogado.toUpperCase(),
        acao, item_nome: itemNome, detalhes
      }]);
      fetchLogs();
    } catch (err) { console.error("Erro log:", err) }
  };

  const prepararDadosGrafico = () => {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return meses.map((mes, index) => {
      const lucroMes = vendas.reduce((acc, v) => {
        const dataVenda = new Date(v.data_exclusao);
        if (dataVenda.getMonth() === index && dataVenda.getFullYear() === new Date().getFullYear()) {
          return acc + ((v.valor_venda_un - v.valor_custo_un) * v.quantidade);
        }
        return acc;
      }, 0);
      return { name: mes, lucro: parseFloat(lucroMes.toFixed(2)) };
    });
  };

  const exportarEstoquePDF = () => {
    try {
      const doc = new jsPDF();
      doc.text("Estoque Geral - Logística", 14, 15);
      const rows = produtos.map(p => [p.sku || '-', p.marca || '-', p.nome?.toUpperCase(), p.quantidade, `R$ ${Number(p.valor_venda || 0).toFixed(2)}`]);
      autoTable(doc, { head: [["SKU", "Marca", "Produto", "Qtd", "Venda"]], body: rows, startY: 25 });
      doc.save("estoque.pdf");
      toast.success("PDF de estoque gerado!");
    } catch (err) { toast.error("Erro ao gerar PDF"); }
  }

  const exportarVendasPDF = () => {
    try {
      const doc = new jsPDF();
      doc.text(`Relatório de Vendas - Geral`, 14, 15);
      const rows = vendas.map(v => [v.nome_item?.toUpperCase(), v.quantidade, v.usuario_que_excluiu, new Date(v.data_exclusao).toLocaleDateString(), `R$ ${((v.valor_venda_un - v.valor_custo_un) * v.quantidade).toFixed(2)}`]);
      autoTable(doc, { head: [["Item", "Qtd", "Vendedor", "Data", "Lucro"]], body: rows, startY: 25 });
      doc.save("vendas.pdf");
      toast.info("PDF de vendas gerado!");
    } catch (err) { toast.error("Erro ao gerar PDF"); }
  }

  const handleAddProduto = async (e) => {
    e.preventDefault()
    if (perfil !== 'gerente') return toast.warning("Acesso restrito!");
    const payload = { nome, quantidade: parseInt(quantidade), marca, sku, ncm, cest, valor_custo: parseFloat(valorCusto || 0), valor_venda: parseFloat(valorVenda || 0), criado_por: session.user.id, ativo: true }
    try {
      if (editandoId) {
        await supabase.from('produtos').update(payload).eq('id', editandoId);
        toast.success("Atualizado!");
      } else {
        await supabase.from('produtos').insert([payload]);
        toast.success("Cadastrado!");
      }
      limparCampos(); fetchProdutos();
    } catch (error) { toast.error("Erro banco"); }
  }

  const processarBaixa = async () => {
    if (qtdMovimentacao > itemSelecionado.quantidade) return toast.error("Estoque baixo!");
    try {
      const { error: vendaErr } = await supabase.from('vendas').insert([{ 
        nome_item: itemSelecionado.nome, 
        quantidade: parseInt(qtdMovimentacao), 
        usuario_que_excluiu: userNameLogado.toUpperCase(), 
        valor_custo_un: itemSelecionado.valor_custo, 
        valor_venda_un: itemSelecionado.valor_venda 
      }]);
      
      if (vendaErr) throw vendaErr;
      await supabase.from('produtos').update({ quantidade: itemSelecionado.quantidade - parseInt(qtdMovimentacao) }).eq('id', itemSelecionado.id);
      registrarLog("VENDA", itemSelecionado.nome, `${qtdMovimentacao} un.`);
      setShowModalBaixa(false);
      await fetchVendas(); 
      await fetchProdutos();
      toast.success("Venda registrada e balanço atualizado!");
    } catch (error) { toast.error("Erro na venda. Verifique as policies."); }
  }

  const processarEntrada = async () => {
    try {
      const novaQtd = itemSelecionado.quantidade + parseInt(qtdMovimentacao);
      await supabase.from('produtos').update({ quantidade: novaQtd }).eq('id', itemSelecionado.id);
      registrarLog("REPOSIÇÃO", itemSelecionado.nome, `+${qtdMovimentacao} un.`);
      setShowModalEntrada(false);
      fetchProdutos();
      toast.success("Entrada OK!");
    } catch (error) { toast.error("Erro entrada"); }
  }

  const limparCampos = () => { setNome(''); setQuantidade(''); setMarca(''); setSku(''); setNcm(''); setCest(''); setValorCusto(''); setValorVenda(''); setEditandoId(null); }

  const produtosFiltrados = produtos.filter(p => {
    const atendePesquisa = p.nome?.toLowerCase().includes(pesquisa.toLowerCase()) || p.sku?.toLowerCase().includes(pesquisa.toLowerCase());
    const atendeEstoqueBaixo = filtroEstoqueBaixo ? p.quantidade < 5 : true;
    return atendePesquisa && atendeEstoqueBaixo;
  });

  const lucroMes = vendas.reduce((acc, v) => {
    const dataVenda = new Date(v.data_exclusao);
    const hoje = new Date();
    if (dataVenda.getMonth() === hoje.getMonth() && dataVenda.getFullYear() === hoje.getFullYear()) {
        return acc + ((v.valor_venda_un - v.valor_custo_un) * v.quantidade || 0);
    }
    return acc;
  }, 0);
  const lucroGeral = vendas.reduce((acc, v) => acc + ((v.valor_venda_un - v.valor_custo_un) * v.quantidade || 0), 0);

  if (!session) return <Login />

  return (
    <div className="app-wrapper">
      <ToastContainer position="bottom-right" autoClose={2000} theme="colored" />
      
      <header className="app-header">
        <div className="header-left-info">
           <h2 className="title-header">Logística & Vendas</h2>
           <div className="user-logged-info">
             <FontAwesomeIcon icon={faUserCircle} /> 
             <span>{userNameLogado || 'Buscando...'}</span>
           </div>
        </div>
        <nav className="admin-tabs">
          <button onClick={() => setAbaAtual('estoque')} className={abaAtual === 'estoque' ? 'tab-active' : ''}><FontAwesomeIcon icon={faBoxesStacked} /> Estoque</button>
          {perfil === 'gerente' && (
            <>
              <button onClick={() => setAbaAtual('vendas')} className={abaAtual === 'vendas' ? 'tab-active' : ''}><FontAwesomeIcon icon={faChartLine} /> Balanço</button>
              <button onClick={() => setAbaAtual('logs')} className={abaAtual === 'logs' ? 'tab-active' : ''}><FontAwesomeIcon icon={faHistory} /> Auditoria</button>
              <button onClick={() => setAbaAtual('usuarios')} className={abaAtual === 'usuarios' ? 'tab-active' : ''}><FontAwesomeIcon icon={faUsers} /> Usuários</button>
            </>
          )}
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="btn-logout">Sair</button>
      </header>

      <main className="app-container">
        {abaAtual === 'estoque' && (
          <div className="content-card">
            <div className="dashboard-cards">
              <div className="card-kpi info"><span className="card-title">Total Itens</span><span className="card-value">{produtos.length}</span></div>
              <div className={`card-kpi alert ${filtroEstoqueBaixo ? 'active-filter' : ''}`} onClick={() => setFiltroEstoqueBaixo(!filtroEstoqueBaixo)} style={{ cursor: 'pointer' }}><span className="card-title">Estoque Baixo</span><span className="card-value text-danger">{produtos.filter(p => p.quantidade < 5).length}</span></div>
            </div>

            {perfil === 'gerente' && (
              <form onSubmit={handleAddProduto} className="form-grid">
                <div className="input-group"><label>Produto</label><input className="input-field" value={nome} onChange={e => setNome(e.target.value)} required /></div>
                <div className="input-group"><label>Qtd</label><input className="input-field" type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} required /></div>
                <div className="input-group"><label>SKU</label><input className="input-field" value={sku} onChange={e => setSku(e.target.value)} /></div>
                <div className="input-group"><label>Marca</label><input className="input-field" value={marca} onChange={e => setMarca(e.target.value)} /></div>
                <div className="input-group"><label>NCM</label><input className="input-field" value={ncm} onChange={e => setNcm(e.target.value)} /></div>
                <div className="input-group"><label>CEST</label><input className="input-field" value={cest} onChange={e => setCest(e.target.value)} /></div>
                <div className="input-group"><label>Custo</label><input className="input-field" type="number" step="0.01" value={valorCusto} onChange={e => setValorCusto(e.target.value)} /></div>
                <div className="input-group"><label>Venda</label><input className="input-field" type="number" step="0.01" value={valorVenda} onChange={e => setValorVenda(e.target.value)} /></div>
                <button type="submit" className="btn-add">{editandoId ? "Salvar Mudanças" : "Cadastrar"}</button>
                {editandoId && <button type="button" onClick={limparCampos} className="btn-cancel cancel-edit-btn">Cancelar</button>}
              </form>
            )}

            <div className="search-bar-container">
              <div className="search-container">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input type="text" placeholder="Pesquisar..." className="search-input" value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
                <button className={`btn-barcode ${scannerAtivo ? 'active' : ''}`} onClick={() => setScannerAtivo(!scannerAtivo)}><FontAwesomeIcon icon={scannerAtivo ? faTimes : faBarcode} /></button>
              </div>
            </div>

            {scannerAtivo && <div className="scanner-wrapper"><div id="reader"></div></div>}

            <table className="data-table">
              <thead><tr><th>SKU</th><th>Marca</th><th>Produto</th><th>Qtd</th><th>Preços</th><th>Ações</th></tr></thead>
              <tbody>{produtosFiltrados.map(p => (<tr key={p.id}><td>{p.sku || '-'}</td><td>{p.marca || '-'}</td><td className="text-bold">{p.nome?.toUpperCase()}</td><td>{p.quantidade}</td><td><small>C: R${p.valor_custo?.toFixed(2)}</small><br/><b className="text-success">V: R${p.valor_venda?.toFixed(2)}</b></td><td>
                {perfil === 'gerente' && (
                  <>
                    <button className="btn-icon" onClick={() => { setEditandoId(p.id); setNome(p.nome); setQuantidade(p.quantidade); setSku(p.sku); setNcm(p.ncm); setCest(p.cest); setValorCusto(p.valor_custo); setValorVenda(p.valor_venda); setMarca(p.marca); }}><FontAwesomeIcon icon={faPenToSquare} color="#1a73e8" /></button>
                    <button className="btn-icon" onClick={() => { setItemSelecionado(p); setShowModalEntrada(true); setQtdMovimentacao(1); }}><FontAwesomeIcon icon={faPlusCircle} color="#fb8c00" /></button>
                  </>
                )}
                <button className="btn-icon" onClick={() => { setItemSelecionado(p); setShowModalBaixa(true); setQtdMovimentacao(1); }}><FontAwesomeIcon icon={faCartArrowDown} color="#2e7d32" /></button>
              </td></tr>))}</tbody>
            </table>
          </div>
        )}

        {abaAtual === 'vendas' && (
          <div className="content-card">
            <div className="header-balanco"><h3>Balanço Financeiro</h3><div className="filter-group"><input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} /></div></div>
            <div className="chart-container"><ResponsiveContainer><BarChart data={prepararDadosGrafico()}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="lucro" radius={[4, 4, 0, 0]}>{prepararDadosGrafico().map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.lucro > 0 ? '#2e7d32' : '#ff4d4d'} />))}</Bar></BarChart></ResponsiveContainer></div>
            <div className="dashboard-cards">
                <div className="card-kpi success"><span className="card-title">Lucro Mês Atual</span><span className="card-value">R$ {lucroMes.toFixed(2)}</span></div>
                <div className="card-kpi info"><span className="card-title">Lucro Total Acumulado</span><span className="card-value">R$ {lucroGeral.toFixed(2)}</span></div>
            </div>
            <table className="data-table"><thead><tr><th>Item</th><th>Qtd</th><th>Data</th><th>Lucro</th></tr></thead><tbody>{vendas.map(v => (<tr key={v.id}><td>{v.nome_item?.toUpperCase()}</td><td>{v.quantidade}</td><td>{new Date(v.data_exclusao).toLocaleDateString()}</td><td className="text-success">R$ {((v.valor_venda_un - v.valor_custo_un) * v.quantidade).toFixed(2)}</td></tr>))}</tbody></table>
          </div>
        )}

        {abaAtual === 'logs' && (
          <div className="content-card">
            <div className="header-auditoria">
              <h3>📜 Auditoria & Relatórios</h3>
              <div className="gap-10">
                <button onClick={exportarEstoquePDF} className="btn-pdf">
                  <FontAwesomeIcon icon={faFilePdf} /> Estoque
                </button>
                <button onClick={exportarVendasPDF} className="btn-pdf">
                  <FontAwesomeIcon icon={faFilePdf} /> Vendas
                </button>
                <button onClick={() => fetchLogs()} className="btn-icon" title="Atualizar Logs">
                  <FontAwesomeIcon icon={faHistory} />
                </button>
              </div>
            </div>
            <table className="data-table"><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Item</th><th>Detalhes</th></tr></thead><tbody>{logs.map(log => (<tr key={log.id}><td>{new Date(log.created_at).toLocaleString('pt-BR')}</td><td><b>{log.usuario}</b></td><td>{log.acao}</td><td>{log.item_nome}</td><td className="small-text">{log.detalhes}</td></tr>))}</tbody></table>
          </div>
        )}

        {abaAtual === 'usuarios' && (
          <div className="content-card">
            <h3 className="title-margin-20"><FontAwesomeIcon icon={faUserPlus} /> Nova Equipe</h3>
            <form onSubmit={handleCriarUsuario} className="form-grid form-cadastro-equipe">
              <div className="input-group"><label>Username</label>
                <input className="input-field" 
                  value={novoUsername} 
                  onChange={e => setNovoUsername(e.target.value)} 
                  required 
                />
              </div>
              <div className="input-group"><label>E-mail Real</label>
                <input className="input-field" 
                  type="email" 
                  value={novoEmail} 
                  onChange={e => setNovoEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="input-group"><label>Senha</label>
                <input className="input-field" 
                  type="password" 
                  value={novaSenha} 
                  onChange={e => setNovaSenha(e.target.value)} // CORRIGIDO: Permite digitar agora
                  required 
                />
              </div>
              <div className="input-group"><label>Cargo</label>
                <select className="input-field" value={novoRole} onChange={e => setNovoRole(e.target.value)}>
                  <option value="vendedor">Vendedor</option>
                  <option value="gerente">Gerente</option>
                </select>
              </div>
              <button type="submit" className="btn-add btn-gerente-dark">Criar Acesso</button>
            </form>
            <h3>👥 Equipe Ativa</h3>
            <table className="data-table"><thead><tr><th>Nome</th><th>Nível</th><th>Ação</th></tr></thead><tbody>{usuarios.map((u, i) => (<tr key={i}><td>{u.username?.toUpperCase()}</td><td>{u.role?.toUpperCase()}</td><td><button className="btn-icon" onClick={() => handleResetSenhaFuncionario(u.username)}><FontAwesomeIcon icon={faKey} color="#e63946" /></button></td></tr>))}</tbody></table>
          </div>
        )}
      </main>

      {showModalBaixa && (
        <div className="modal-overlay"><div className="modal-content"><h3>Vender Item: {itemSelecionado?.nome}</h3><input type="number" value={qtdMovimentacao} onChange={e => setQtdMovimentacao(e.target.value)} className="input-field" min="1" /><div className="modal-actions"><button onClick={() => setShowModalBaixa(false)} className="btn-cancel">Sair</button><button onClick={processarBaixa} className="btn-confirm">Vender</button></div></div></div>
      )}

      {showModalEntrada && (
        <div className="modal-overlay"><div className="modal-content"><h3>Reposição: {itemSelecionado?.nome}</h3><input type="number" value={qtdMovimentacao} onChange={e => setQtdMovimentacao(e.target.value)} className="input-field" min="1" /><div className="modal-actions"><button onClick={() => setShowModalEntrada(false)} className="btn-cancel">Sair</button><button onClick={processarEntrada} className="btn-confirm btn-confirm-entrada">Gravar</button></div></div></div>
      )}
    </div>
  )
}

export default App