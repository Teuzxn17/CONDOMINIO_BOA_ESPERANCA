import { useState, useEffect, useCallback } from "react";

// ============================================================
// SUPABASE CLIENT
// ============================================================
const SUPABASE_URL = "https://sjvvckvqlornvjevgvku.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnZja3ZxbG9ybnZqZXZndmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NzE1MjIsImV4cCI6MjA5MDE0NzUyMn0.-tpGD7qR-C2Kbz6q4zJKLaIcFABbThfvbYntFGmYDSc";

const sb = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Erro Supabase");
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const api = {
  // Moradores
  getMoradores: () => sb("moradores?order=casa_id.asc"),
  addMorador: (data) => sb("moradores", { method: "POST", body: JSON.stringify(data) }),
  updateMorador: (id, data) => sb(`moradores?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMorador: (id) => sb(`moradores?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),

  // Pagamentos
  getPagamentos: () => sb("pagamentos?order=created_at.desc"),
  addPagamento: (data) => sb("pagamentos", { method: "POST", body: JSON.stringify(data) }),
  deletePagamento: (id) => sb(`pagamentos?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),

  // Financeiro
  getFinanceiro: () => sb("financeiro?order=data.desc"),
  addFinanceiro: (data) => sb("financeiro", { method: "POST", body: JSON.stringify(data) }),
  deleteFinanceiro: (id) => sb(`financeiro?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
};

// ============================================================
// TYPES & CONSTANTS
// ============================================================
const STATUS_COLORS = {
  pago:     { bg: "#10b981", light: "#d1fae5", text: "#065f46", label: "Pago" },
  pendente: { bg: "#ef4444", light: "#fee2e2", text: "#991b1b", label: "Pendente" },
  atrasado: { bg: "#f59e0b", light: "#fef3c7", text: "#92400e", label: "Atrasado" },
  vazio:    { bg: "#6b7280", light: "#f3f4f6", text: "#374151", label: "Sem morador" },
};
const FORMAS_PAG = ["pix", "dinheiro", "debito", "credito"];
const CATEGORIAS = ["fixo", "variavel", "emergencial", "outro"];

// ============================================================
// HELPERS
// ============================================================
const fmtMoeda = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData  = (s) => s ? new Date(s + (s.includes("T") ? "" : "T12:00:00")).toLocaleDateString("pt-BR") : "-";
const capFirst = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const buildMes = (date) => { const d = new Date(date); return `${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`; };
const getMesAtual = () => buildMes(new Date());
const parseMes = (mes) => { const [m,y] = mes.split("-"); return new Date(+y, +m-1, 1); };
const navMes = (mes, delta) => { const d = parseMes(mes); d.setMonth(d.getMonth()+delta); return buildMes(d); };
const formatMes = (mes) => { const [m,y] = mes.split("-"); return new Date(+y,+m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}); };

const getStatusCasa = (casaId, mes, pagamentos) => {
  const m = mes || getMesAtual();
  if (pagamentos.some(p => p.casa_id === casaId && p.mes === m)) return "pago";
  const ant = navMes(m, -1);
  return pagamentos.some(p => p.casa_id === casaId && p.mes === ant) ? "pendente" : "atrasado";
};

// ============================================================
// ICONS
// ============================================================
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const paths = {
    home:       "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    building:   "M1 21h22M5 21V7l7-4 7 4v14M9 21v-4h6v4",
    plus:       "M12 5v14M5 12h14",
    wallet:     "M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5M16 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    chart:      "M18 20V10M12 20V4M6 20v-6",
    arrow_l:    "M15 18l-6-6 6-6",
    arrow_r:    "M9 18l6-6-6-6",
    arrow_up:   "M12 19V5M5 12l7-7 7 7",
    arrow_down: "M12 5v14M19 12l-7 7-7-7",
    check:      "M20 6L9 17l-5-5",
    edit:       "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
    trash:      "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2",
    search:     "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
    user:       "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    filter:     "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
    x:          "M18 6L6 18M6 6l12 12",
    dollar:     "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    refresh:    "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
};

// ============================================================
// TOAST
// ============================================================
const ToastList = ({ toasts }) => (
  <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none", width:"90%", maxWidth:380 }}>
    {toasts.map(t => (
      <div key={t.id} style={{ background: t.type==="error" ? "#fee2e2" : "#d1fae5", color: t.type==="error" ? "#991b1b" : "#065f46", padding:"12px 16px", borderRadius:12, fontSize:14, fontWeight:500, boxShadow:"0 4px 20px rgba(0,0,0,.15)", animation:"slideUp .3s ease" }}>
        {t.msg}
      </div>
    ))}
  </div>
);

// ============================================================
// LOADING
// ============================================================
const Spinner = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200 }}>
    <div style={{ width:36, height:36, border:"3px solid #1e293b", borderTop:"3px solid #38bdf8", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
  </div>
);

// ============================================================
// BOTTOM NAV
// ============================================================
const BottomNav = ({ page, setPage }) => {
  const tabs = [
    { id:"dashboard", icon:"home",     label:"Início"    },
    { id:"casas",     icon:"building", label:"Casas"     },
    { id:"cadastro",  icon:"plus",     label:"Cadastro"  },
    { id:"financeiro",icon:"wallet",   label:"Financeiro"},
    { id:"relatorios",icon:"chart",    label:"Relatórios"},
  ];
  return (
    <nav style={{ position:"fixed", bottom:0, left:0, right:0, background:"#0f172a", borderTop:"1px solid #1e293b", display:"flex", zIndex:100, height:64, maxWidth:480, margin:"0 auto" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setPage(t.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, border:"none", background:"none", cursor:"pointer", color: page===t.id ? "#38bdf8" : "#64748b", transition:"color .2s", padding:0 }}>
          <Icon name={t.icon} size={20} color={page===t.id ? "#38bdf8" : "#64748b"} />
          <span style={{ fontSize:10, fontWeight: page===t.id ? 700 : 400, letterSpacing:.3 }}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
};

// ============================================================
// HOUSE CARD
// ============================================================
const HouseCard = ({ morador, status, onClick }) => {
  const s = STATUS_COLORS[status] || STATUS_COLORS.vazio;
  return (
    <button onClick={onClick} style={{ width:"100%", background:"#1e293b", border:`1px solid ${s.bg}33`, borderRadius:16, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", textAlign:"left", transition:"transform .15s, box-shadow .15s" }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow=`0 8px 24px ${s.bg}22`; }}
      onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
      <div style={{ width:42, height:42, borderRadius:12, background:`${s.bg}22`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <span style={{ fontSize:18 }}>🏠</span>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:"#f1f5f9", fontWeight:600, fontSize:15, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{morador.nome}</div>
        <div style={{ color:"#94a3b8", fontSize:12, marginTop:2 }}>Casa {morador.casa_id}</div>
      </div>
      <div style={{ background:`${s.bg}22`, color:s.bg, border:`1px solid ${s.bg}55`, borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:700, flexShrink:0 }}>{s.label}</div>
    </button>
  );
};

// ============================================================
// DASHBOARD
// ============================================================
const Dashboard = ({ moradores, pagamentos, financeiro }) => {
  const mesAtual = getMesAtual();
  const inadimplentes = moradores.filter(m => getStatusCasa(m.casa_id, mesAtual, pagamentos) !== "pago").length;
  const pagos = moradores.filter(m => getStatusCasa(m.casa_id, mesAtual, pagamentos) === "pago").length;
  const recebidoMes = pagamentos.filter(p => p.mes === mesAtual).reduce((a,p) => a+p.valor, 0);
  const saldo = pagamentos.reduce((a,p)=>a+p.valor,0) + financeiro.filter(f=>f.tipo==="entrada").reduce((a,f)=>a+f.valor,0) - financeiro.filter(f=>f.tipo==="saida").reduce((a,f)=>a+f.valor,0);

  const Card = ({ label, value, color, icon, sub }) => (
    <div style={{ background:"#1e293b", borderRadius:16, padding:"18px 20px", border:`1px solid ${color}33` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ color:"#94a3b8", fontSize:12, fontWeight:500, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
          <div style={{ color, fontSize:22, fontWeight:800, marginTop:6 }}>{value}</div>
          {sub && <div style={{ color:"#64748b", fontSize:11, marginTop:4 }}>{sub}</div>}
        </div>
        <div style={{ background:`${color}15`, borderRadius:10, padding:10 }}>
          <Icon name={icon} size={20} color={color} />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding:"20px 16px", paddingBottom:80 }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ color:"#94a3b8", fontSize:13 }}>Bem-vindo ao</div>
        <h1 style={{ color:"#f1f5f9", fontSize:24, fontWeight:800, margin:"4px 0" }}>Gestão Condomínio</h1>
        <div style={{ color:"#38bdf8", fontSize:13 }}>{capFirst(formatMes(mesAtual))}</div>
      </div>
      <div style={{ background:"linear-gradient(135deg,#0ea5e9,#2563eb)", borderRadius:20, padding:"24px", marginBottom:20, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-20, right:-20, width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,.08)" }} />
        <div style={{ color:"rgba(255,255,255,.8)", fontSize:13, fontWeight:500 }}>Saldo Total</div>
        <div style={{ color:"#fff", fontSize:32, fontWeight:900, marginTop:4 }}>{fmtMoeda(saldo)}</div>
        <div style={{ color:"rgba(255,255,255,.6)", fontSize:12, marginTop:6 }}>Pagamentos + Entradas − Saídas</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <Card label="Casas"        value={moradores.length} color="#38bdf8" icon="building" sub="cadastradas" />
        <Card label="Inadimplentes" value={inadimplentes}   color="#f87171" icon="user"     sub="neste mês"   />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Card label="Pagos"    value={pagos}              color="#34d399" icon="check"  sub="neste mês"       />
        <Card label="Recebido" value={fmtMoeda(recebidoMes)} color="#a78bfa" icon="dollar" sub="em pagamentos" />
      </div>
    </div>
  );
};

// ============================================================
// CASAS
// ============================================================
const Casas = ({ moradores, pagamentos, setPage, setSelectedCasa }) => {
  const [mes, setMes] = useState(getMesAtual());
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  // Calcula status de todos primeiro
  const moradoresComStatus = moradores.map(m => ({
    ...m,
    status: getStatusCasa(m.casa_id, mes, pagamentos),
  }));

  // Counts para os badges (antes do filtro de status, mas depois da busca)
  const buscados = moradoresComStatus.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    m.casa_id.toLowerCase().includes(busca.toLowerCase())
  );
  const counts = { pago:0, pendente:0, atrasado:0 };
  buscados.forEach(m => { if (counts[m.status] !== undefined) counts[m.status]++; });

  // Lista final com filtro de status aplicado
  const filtrados = buscados.filter(m =>
    filtroStatus === "todos" ? true : m.status === filtroStatus
  );

  const statusBtns = [
    { key:"todos",    label:"Todos",    color:"#38bdf8" },
    { key:"pago",     label:"Pagos",    color:STATUS_COLORS.pago.bg     },
    { key:"pendente", label:"Pendente", color:STATUS_COLORS.pendente.bg },
    { key:"atrasado", label:"Atrasado", color:STATUS_COLORS.atrasado.bg },
  ];

  return (
    <div style={{ padding:"20px 16px", paddingBottom:80 }}>
      <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, marginBottom:16 }}>Casas</h1>

      {/* Navegação de mês */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#1e293b", borderRadius:14, padding:"10px 16px", marginBottom:16 }}>
        <button onClick={() => setMes(navMes(mes,-1))} style={{ background:"none", border:"none", color:"#38bdf8", cursor:"pointer", padding:4 }}><Icon name="arrow_l" size={18} color="#38bdf8" /></button>
        <span style={{ color:"#f1f5f9", fontWeight:700, fontSize:14 }}>{capFirst(formatMes(mes))}</span>
        <button onClick={() => setMes(navMes(mes,1))}  style={{ background:"none", border:"none", color:"#38bdf8", cursor:"pointer", padding:4 }}><Icon name="arrow_r" size={18} color="#38bdf8" /></button>
      </div>

      {/* Busca */}
      <div style={{ position:"relative", marginBottom:12 }}>
        <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }}><Icon name="search" size={16} color="#64748b" /></div>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou casa..."
          style={{ width:"100%", background:"#1e293b", border:"1px solid #334155", borderRadius:12, padding:"11px 12px 11px 38px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }}
        />
      </div>

      {/* Badges de contagem — clicáveis como filtro */}
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {Object.entries(counts).map(([k,v]) => {
          const ativo = filtroStatus === k;
          return (
            <button key={k} onClick={() => setFiltroStatus(filtroStatus === k ? "todos" : k)}
              style={{ flex:1, background: ativo ? `${STATUS_COLORS[k].bg}30` : `${STATUS_COLORS[k].bg}10`, border:`1.5px solid ${ativo ? STATUS_COLORS[k].bg : STATUS_COLORS[k].bg+"33"}`, borderRadius:10, padding:"8px 0", textAlign:"center", cursor:"pointer", transition:"all .15s" }}>
              <div style={{ color:STATUS_COLORS[k].bg, fontWeight:800, fontSize:18 }}>{v}</div>
              <div style={{ color:STATUS_COLORS[k].bg, fontSize:10, fontWeight:600 }}>{STATUS_COLORS[k].label}</div>
            </button>
          );
        })}
      </div>

      {/* Filtro de status por botões de texto */}
      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {statusBtns.map(b => (
          <button key={b.key} onClick={() => setFiltroStatus(b.key)}
            style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${filtroStatus===b.key ? b.color : "#334155"}`, background: filtroStatus===b.key ? `${b.color}18` : "transparent", color: filtroStatus===b.key ? b.color : "#64748b", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all .15s" }}>
            {b.label} {b.key !== "todos" && `(${counts[b.key] ?? 0})`}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div style={{ textAlign:"center", color:"#64748b", marginTop:60 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏘️</div>
          <div>Nenhuma casa encontrada</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtrados.map(m => (
            <HouseCard key={m.id} morador={m} status={m.status}
              onClick={() => { setSelectedCasa(m); setPage("casa_detalhe"); }} />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// CASA DETALHE
// ============================================================
const CasaDetalhe = ({ casa, pagamentos, setPage, toast, reload }) => {
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ ...casa });
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pagForm, setPagForm] = useState({ valor:150, forma:"pix", mes:getMesAtual(), dataPagamento: new Date().toISOString().split("T")[0] });

  const pagsCasa = pagamentos.filter(p => p.casa_id === casa.casa_id).sort((a,b) => new Date(b.data_pagamento)-new Date(a.data_pagamento));
  const statusAtual = getStatusCasa(casa.casa_id, null, pagamentos);
  const s = STATUS_COLORS[statusAtual];

  const handleSaveEdit = async () => {
    if (!editData.nome || !editData.telefone || !editData.quadra || !editData.numero_casa) { toast("Preencha todos os campos","error"); return; }
    setLoading(true);
    try {
      await api.updateMorador(casa.id, { nome:editData.nome, telefone:editData.telefone, cpf:editData.cpf, quadra:editData.quadra.toUpperCase(), numero_casa:editData.numero_casa, casa_id:`${editData.quadra.toUpperCase()}-${editData.numero_casa}` });
      await reload();
      setEditMode(false);
      toast("Dados atualizados!");
    } catch { toast("Erro ao atualizar","error"); } finally { setLoading(false); }
  };

  const handlePagar = async () => {
    if (pagForm.valor <= 0) { toast("Valor inválido","error"); return; }
    setLoading(true);
    try {
      await api.addPagamento({ casa_id:casa.casa_id, mes:pagForm.mes, valor:+pagForm.valor, forma_pagamento:pagForm.forma, data_pagamento: new Date(pagForm.dataPagamento + "T12:00:00").toISOString() });
      await reload();
      setShowModal(false);
      toast("Pagamento registrado!");
    } catch { toast("Erro ao registrar pagamento","error"); } finally { setLoading(false); }
  };

  const handleDeletePag = async (id) => {
    if (!confirm("Excluir pagamento?")) return;
    setLoading(true);
    try { await api.deletePagamento(id); await reload(); toast("Pagamento excluído."); }
    catch { toast("Erro ao excluir","error"); } finally { setLoading(false); }
  };

  const handleDeleteMorador = async () => {
    if (!confirm(`Excluir ${casa.nome}?`)) return;
    setLoading(true);
    try { await api.deleteMorador(casa.id); await reload(); setPage("casas"); }
    catch { toast("Erro ao excluir","error"); } finally { setLoading(false); }
  };

  const Field = ({ label, val, field }) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ color:"#64748b", fontSize:12, marginBottom:4 }}>{label}</div>
      {editMode
        ? <input value={editData[field]||""} onChange={e => setEditData(p=>({...p,[field]:e.target.value}))}
            style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"10px 12px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
        : <div style={{ color:"#f1f5f9", fontSize:15, fontWeight:500 }}>{val||"—"}</div>
      }
    </div>
  );

  return (
    <div style={{ padding:"20px 16px", paddingBottom:80 }}>
      <button onClick={() => setPage("casas")} style={{ background:"none", border:"none", color:"#38bdf8", cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontSize:14, padding:0, marginBottom:16 }}>
        <Icon name="arrow_l" size={16} color="#38bdf8" /> Voltar
      </button>

      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
        <div style={{ width:56, height:56, borderRadius:16, background:`${s.bg}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🏠</div>
        <div style={{ flex:1 }}>
          <h1 style={{ color:"#f1f5f9", fontSize:20, fontWeight:800, margin:0 }}>{casa.nome}</h1>
          <div style={{ color:"#94a3b8", fontSize:13 }}>Casa {casa.casa_id}</div>
        </div>
        <div style={{ background:`${s.bg}22`, color:s.bg, border:`1px solid ${s.bg}55`, borderRadius:10, padding:"6px 12px", fontSize:12, fontWeight:700 }}>{s.label}</div>
      </div>

      <div style={{ background:"#1e293b", borderRadius:16, padding:"20px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
          <h2 style={{ color:"#f1f5f9", fontSize:15, fontWeight:700, margin:0 }}>Informações</h2>
          <div style={{ display:"flex", gap:8 }}>
            {editMode ? (
              <>
                <button onClick={handleSaveEdit} disabled={loading} style={{ background:"#10b981", border:"none", color:"#fff", borderRadius:8, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" }}>Salvar</button>
                <button onClick={() => setEditMode(false)} style={{ background:"#334155", border:"none", color:"#94a3b8", borderRadius:8, padding:"6px 14px", fontSize:13, cursor:"pointer" }}>Cancelar</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditMode(true)} style={{ background:"#334155", border:"none", color:"#38bdf8", borderRadius:8, padding:"6px 12px", cursor:"pointer" }}><Icon name="edit" size={15} color="#38bdf8" /></button>
                <button onClick={handleDeleteMorador} style={{ background:"#ef444422", border:"none", color:"#f87171", borderRadius:8, padding:"6px 12px", cursor:"pointer" }}><Icon name="trash" size={15} color="#f87171" /></button>
              </>
            )}
          </div>
        </div>
        <Field label="Nome"     val={casa.nome}        field="nome"        />
        <Field label="Telefone" val={casa.telefone}    field="telefone"    />
        <Field label="CPF"      val={casa.cpf}         field="cpf"         />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Quadra"  val={casa.quadra}      field="quadra"      />
          <Field label="Nº Casa" val={casa.numero_casa} field="numero_casa" />
        </div>
      </div>

      {statusAtual !== "pago" && (
        <button onClick={() => setShowModal(true)} style={{ width:"100%", background:"linear-gradient(135deg,#10b981,#059669)", border:"none", borderRadius:14, padding:"16px", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer", marginBottom:16 }}>
          ✓ Marcar como Pago
        </button>
      )}

      <div style={{ background:"#1e293b", borderRadius:16, padding:"20px" }}>
        <h2 style={{ color:"#f1f5f9", fontSize:15, fontWeight:700, margin:"0 0 16px" }}>Histórico de Pagamentos</h2>
        {pagsCasa.length === 0
          ? <div style={{ color:"#64748b", textAlign:"center", padding:"20px 0", fontSize:14 }}>Nenhum pagamento registrado</div>
          : pagsCasa.map(p => (
            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #0f172a" }}>
              <div>
                <div style={{ color:"#f1f5f9", fontWeight:600, fontSize:14 }}>{capFirst(formatMes(p.mes))}</div>
                <div style={{ color:"#64748b", fontSize:12, marginTop:2 }}>{fmtData(p.data_pagamento)} · {capFirst(p.forma_pagamento)}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:"#34d399", fontWeight:700, fontSize:15 }}>{fmtMoeda(p.valor)}</span>
                <button onClick={() => handleDeletePag(p.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Icon name="trash" size={14} color="#ef4444" /></button>
              </div>
            </div>
          ))
        }
      </div>

      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", display:"flex", alignItems:"flex-end", zIndex:200 }} onClick={() => setShowModal(false)}>
          <div style={{ background:"#1e293b", borderRadius:"20px 20px 0 0", padding:24, width:"100%", boxSizing:"border-box" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:800, marginBottom:20 }}>Registrar Pagamento</h2>
            <div style={{ marginBottom:14 }}>
              <label style={{ color:"#94a3b8", fontSize:12, display:"block", marginBottom:6 }}>Mês</label>
              <input type="month" value={pagForm.mes.split("-").reverse().join("-")}
                onChange={e => { const [y,m]=e.target.value.split("-"); setPagForm(p=>({...p,mes:`${m}-${y}`})); }}
                style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"10px 12px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ color:"#94a3b8", fontSize:12, display:"block", marginBottom:6 }}>Valor (R$)</label>
              <input type="number" value={pagForm.valor} min="0" step="0.01" onChange={e => setPagForm(p=>({...p,valor:e.target.value}))}
                style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"10px 12px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ color:"#94a3b8", fontSize:12, display:"block", marginBottom:6 }}>Data do Pagamento</label>
              <input type="date" value={pagForm.dataPagamento} onChange={e => setPagForm(p=>({...p,dataPagamento:e.target.value}))}
                style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"10px 12px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              <div style={{ color:"#64748b", fontSize:11, marginTop:4 }}>Pré-preenchida com hoje. Altere se necessário.</div>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ color:"#94a3b8", fontSize:12, display:"block", marginBottom:8 }}>Forma de Pagamento</label>
              <div style={{ display:"flex", gap:8 }}>
                {FORMAS_PAG.map(f => (
                  <button key={f} onClick={() => setPagForm(p=>({...p,forma:f}))}
                    style={{ flex:1, padding:"10px 4px", borderRadius:10, border:`1.5px solid ${pagForm.forma===f?"#38bdf8":"#334155"}`, background: pagForm.forma===f?"#38bdf815":"#0f172a", color: pagForm.forma===f?"#38bdf8":"#64748b", fontSize:12, fontWeight:600, cursor:"pointer", textTransform:"capitalize" }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handlePagar} disabled={loading} style={{ width:"100%", background:"linear-gradient(135deg,#10b981,#059669)", border:"none", borderRadius:12, padding:"15px", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer", opacity:loading?.7:1 }}>
              {loading ? "Salvando..." : "Confirmar Pagamento"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// CADASTRO
// ============================================================
const CadastroField = ({ label, value, onChange, placeholder, required, type = "text" }) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ color:"#94a3b8", fontSize:12, display:"block", marginBottom:6 }}>
      {label}{required && <span style={{ color:"#f87171" }}> *</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ width:"100%", background:"#1e293b", border:"1px solid #334155", borderRadius:12, padding:"12px 14px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }}
    />
  </div>
);

const Cadastro = ({ toast, reload, setPage }) => {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [quadra, setQuadra] = useState("");
  const [numeroCasa, setNumeroCasa] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!nome || !telefone || !quadra || !numeroCasa) { toast("Preencha todos os campos obrigatórios","error"); return; }
    setLoading(true);
    try {
      await api.addMorador({ nome, telefone, cpf, quadra: quadra.toUpperCase(), numero_casa: numeroCasa, casa_id:`${quadra.toUpperCase()}-${numeroCasa}` });
      await reload();
      toast("Condômino cadastrado com sucesso!");
      setNome(""); setTelefone(""); setCpf(""); setQuadra(""); setNumeroCasa("");
      setPage("casas");
    } catch { toast("Erro ao cadastrar","error"); } finally { setLoading(false); }
  };

  return (
    <div style={{ padding:"20px 16px", paddingBottom:80 }}>
      <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, marginBottom:4 }}>Novo Condômino</h1>
      <p style={{ color:"#64748b", fontSize:13, marginBottom:24 }}>Preencha os dados do morador</p>
      <div style={{ background:"#1e293b", borderRadius:16, padding:"20px" }}>
        <CadastroField label="Nome completo" value={nome}     onChange={e => setNome(e.target.value)}     placeholder="João da Silva"   required />
        <CadastroField label="Telefone"      value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(91) 99999-9999" required />
        <CadastroField label="CPF"           value={cpf}      onChange={e => setCpf(e.target.value)}      placeholder="000.000.000-00"  />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <label style={{ color:"#94a3b8", fontSize:12, display:"block", marginBottom:6 }}>Quadra <span style={{ color:"#f87171" }}>*</span></label>
            <input value={quadra} onChange={e => setQuadra(e.target.value.toUpperCase())} placeholder="A"
              style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"12px 14px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ color:"#94a3b8", fontSize:12, display:"block", marginBottom:6 }}>Nº Casa <span style={{ color:"#f87171" }}>*</span></label>
            <input value={numeroCasa} onChange={e => setNumeroCasa(e.target.value)} placeholder="01"
              style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"12px 14px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
        </div>
        {quadra && numeroCasa && (
          <div style={{ background:"#38bdf815", border:"1px solid #38bdf833", borderRadius:10, padding:"10px 14px", marginTop:16, color:"#38bdf8", fontSize:13 }}>
            ID da Casa: <strong>{quadra.toUpperCase()}-{numeroCasa}</strong>
          </div>
        )}
      </div>
      <button onClick={handleSubmit} disabled={loading} style={{ width:"100%", background:"linear-gradient(135deg,#0ea5e9,#2563eb)", border:"none", borderRadius:14, padding:"16px", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer", marginTop:20, opacity:loading?.7:1 }}>
        {loading ? "Salvando..." : "Cadastrar Condômino"}
      </button>
    </div>
  );
};

// ============================================================
// FINANCEIRO
// ============================================================
const Financeiro = ({ financeiro, toast, reload }) => {
  const [form, setForm] = useState({ tipo:"entrada", descricao:"", valor:"", data:new Date().toISOString().split("T")[0], categoria:"" });
  const [filtros, setFiltros] = useState({ tipo:"todos", mes:"", dataInicio:"", dataFim:"", categoria:"" });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!form.descricao) { toast("Informe uma descrição","error"); return; }
    if (!form.valor || +form.valor<=0) { toast("Valor inválido","error"); return; }
    if (!form.data) { toast("Informe a data","error"); return; }
    setLoading(true);
    try {
      await api.addFinanceiro({ ...form, valor:+form.valor });
      await reload();
      toast(`${form.tipo==="entrada"?"Entrada":"Saída"} cadastrada com sucesso!`);
      setForm({ tipo:"entrada", descricao:"", valor:"", data:new Date().toISOString().split("T")[0], categoria:"" });
      setShowForm(false);
    } catch { toast("Erro ao salvar","error"); } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir movimentação?")) return;
    try { await api.deleteFinanceiro(id); await reload(); toast("Movimentação excluída."); }
    catch { toast("Erro ao excluir","error"); }
  };

  const filtrado = financeiro.filter(f => {
    if (filtros.tipo !== "todos" && f.tipo !== filtros.tipo) return false;
    if (filtros.categoria && f.categoria !== filtros.categoria) return false;
    const d = new Date(f.data+"T12:00:00");
    if (filtros.mes) { const [y,m]=filtros.mes.split("-"); if(d.getFullYear()!==+y||d.getMonth()+1!==+m) return false; }
    if (filtros.dataInicio && d < new Date(filtros.dataInicio+"T00:00:00")) return false;
    if (filtros.dataFim   && d > new Date(filtros.dataFim+"T23:59:59"))   return false;
    return true;
  });

  const totais = filtrado.reduce((acc,f)=>{ acc[f.tipo]+=f.valor; return acc; },{entrada:0,saida:0});

  return (
    <div style={{ padding:"20px 16px", paddingBottom:80 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:0 }}>Financeiro</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ background:"#0ea5e9", border:"none", borderRadius:10, padding:"8px 14px", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          <Icon name="plus" size={16} color="#fff" /> Novo
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
        {[{label:"Entradas",val:totais.entrada,color:"#34d399"},{label:"Saídas",val:totais.saida,color:"#f87171"},{label:"Saldo",val:totais.entrada-totais.saida,color:totais.entrada-totais.saida>=0?"#38bdf8":"#f87171"}].map(c=>(
          <div key={c.label} style={{ background:"#1e293b", borderRadius:12, padding:"12px 10px", textAlign:"center" }}>
            <div style={{ color:"#64748b", fontSize:10, fontWeight:600, textTransform:"uppercase" }}>{c.label}</div>
            <div style={{ color:c.color, fontSize:13, fontWeight:800, marginTop:4 }}>{fmtMoeda(c.val)}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ background:"#1e293b", borderRadius:16, padding:"20px", marginBottom:16 }}>
          <h2 style={{ color:"#f1f5f9", fontSize:15, fontWeight:700, marginBottom:16 }}>Nova Movimentação</h2>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            {["entrada","saida"].map(t=>(
              <button key={t} onClick={()=>setForm(p=>({...p,tipo:t}))}
                style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background: form.tipo===t?(t==="entrada"?"#10b981":"#ef4444"):"#0f172a", color: form.tipo===t?"#fff":"#64748b", fontWeight:600, fontSize:14, cursor:"pointer" }}>
                {t==="entrada"?"↑ Entrada":"↓ Saída"}
              </button>
            ))}
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ color:"#94a3b8", fontSize:12, display:"block", marginBottom:6 }}>Descrição *</label>
            <input value={form.descricao} onChange={e=>setForm(p=>({...p,descricao:e.target.value}))} placeholder="Ex: Manutenção portão"
              style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"10px 12px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <label style={{ color:"#94a3b8", fontSize:12, display:"block", marginBottom:6 }}>Valor *</label>
              <input type="number" value={form.valor} min="0" step="0.01" onChange={e=>setForm(p=>({...p,valor:e.target.value}))}
                style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"10px 12px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ color:"#94a3b8", fontSize:12, display:"block", marginBottom:6 }}>Data *</label>
              <input type="date" value={form.data} onChange={e=>setForm(p=>({...p,data:e.target.value}))}
                style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"10px 12px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ color:"#94a3b8", fontSize:12, display:"block", marginBottom:6 }}>Categoria</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["",...CATEGORIAS].map(c=>(
                <button key={c} onClick={()=>setForm(p=>({...p,categoria:c}))}
                  style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${form.categoria===c?"#38bdf8":"#334155"}`, background: form.categoria===c?"#38bdf815":"transparent", color: form.categoria===c?"#38bdf8":"#64748b", fontSize:12, cursor:"pointer" }}>
                  {c||"Nenhuma"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleAdd} disabled={loading} style={{ width:"100%", background: form.tipo==="entrada"?"linear-gradient(135deg,#10b981,#059669)":"linear-gradient(135deg,#ef4444,#dc2626)", border:"none", borderRadius:12, padding:"14px", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", opacity:loading?.7:1 }}>
            {loading?"Salvando...": `Adicionar ${form.tipo==="entrada"?"Entrada":"Saída"}`}
          </button>
        </div>
      )}

      <div style={{ background:"#1e293b", borderRadius:16, padding:"16px", marginBottom:16 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          {[["todos","Todos"],["entrada","Entradas"],["saida","Saídas"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFiltros(p=>({...p,tipo:v}))}
              style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${filtros.tipo===v?"#38bdf8":"#334155"}`, background: filtros.tipo===v?"#38bdf815":"transparent", color: filtros.tipo===v?"#38bdf8":"#64748b", fontSize:12, cursor:"pointer" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <input type="month" value={filtros.mes} onChange={e=>setFiltros(p=>({...p,mes:e.target.value}))}
            style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"8px 10px", color:"#f1f5f9", fontSize:12, outline:"none" }} />
          <select value={filtros.categoria} onChange={e=>setFiltros(p=>({...p,categoria:e.target.value}))}
            style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"8px 10px", color:"#f1f5f9", fontSize:12, outline:"none" }}>
            <option value="">Todas categ.</option>
            {CATEGORIAS.map(c=><option key={c} value={c}>{capFirst(c)}</option>)}
          </select>
        </div>
      </div>

      {filtrado.length===0
        ? <div style={{ textAlign:"center", color:"#64748b", marginTop:40, fontSize:14 }}>Nenhuma movimentação encontrada</div>
        : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtrado.map(f=>(
              <div key={f.id} style={{ background:"#1e293b", borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, border:`1px solid ${f.tipo==="entrada"?"#10b98122":"#ef444422"}` }}>
                <div style={{ width:38, height:38, borderRadius:10, background: f.tipo==="entrada"?"#10b98122":"#ef444422", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Icon name={f.tipo==="entrada"?"arrow_up":"arrow_down"} size={18} color={f.tipo==="entrada"?"#34d399":"#f87171"} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:"#f1f5f9", fontWeight:600, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{f.descricao}</div>
                  <div style={{ display:"flex", gap:8, marginTop:3, alignItems:"center" }}>
                    <span style={{ color:"#64748b", fontSize:11 }}>{fmtData(f.data)}</span>
                    {f.categoria&&<span style={{ background:"#334155", color:"#94a3b8", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:600 }}>{capFirst(f.categoria)}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ color: f.tipo==="entrada"?"#34d399":"#f87171", fontWeight:700, fontSize:15 }}>{f.tipo==="saida"?"-":"+"}{fmtMoeda(f.valor)}</span>
                  <button onClick={()=>handleDelete(f.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Icon name="trash" size={14} color="#ef4444" /></button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
};

// ============================================================
// RELATÓRIOS
// ============================================================
const Relatorios = ({ moradores, pagamentos, financeiro }) => {
  const [filtros, setFiltros] = useState({ tipo:"todos", mes:"", dataInicio:"", dataFim:"", categoria:"" });
  const getMoradorNome = (casaId) => moradores.find(m=>m.casa_id===casaId)?.nome || casaId;

  const allItems = [
    ...pagamentos.map(p=>({ id:p.id, tipo:"entrada", descricao:`Mensalidade — ${getMoradorNome(p.casa_id)} (${p.casa_id})`, valor:p.valor, data:p.data_pagamento?.split("T")[0]||"", categoria:"mensalidade", sub:capFirst(formatMes(p.mes)) })),
    ...financeiro.map(f=>({ ...f, sub:f.categoria?capFirst(f.categoria):undefined })),
  ].filter(i=>{
    if (filtros.tipo!=="todos" && i.tipo!==filtros.tipo) return false;
    if (filtros.categoria && i.categoria!==filtros.categoria) return false;
    const d = new Date((i.data||"")+"T12:00:00");
    if (filtros.mes) { const [y,m]=filtros.mes.split("-"); if(d.getFullYear()!==+y||d.getMonth()+1!==+m) return false; }
    if (filtros.dataInicio && d<new Date(filtros.dataInicio+"T00:00:00")) return false;
    if (filtros.dataFim   && d>new Date(filtros.dataFim+"T23:59:59"))   return false;
    return true;
  }).sort((a,b)=>new Date(b.data)-new Date(a.data));

  const totais = allItems.reduce((acc,i)=>{ acc[i.tipo]+=i.valor; return acc; },{entrada:0,saida:0});

  return (
    <div style={{ padding:"20px 16px", paddingBottom:80 }}>
      <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, marginBottom:16 }}>Relatórios</h1>

      <div style={{ background:"#1e293b", borderRadius:16, padding:"16px 20px", marginBottom:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <div><div style={{ color:"#64748b", fontSize:11 }}>Entradas</div><div style={{ color:"#34d399", fontWeight:800, fontSize:14, marginTop:2 }}>{fmtMoeda(totais.entrada)}</div></div>
          <div><div style={{ color:"#64748b", fontSize:11 }}>Saídas</div><div style={{ color:"#f87171", fontWeight:800, fontSize:14, marginTop:2 }}>{fmtMoeda(totais.saida)}</div></div>
          <div><div style={{ color:"#64748b", fontSize:11 }}>Saldo</div><div style={{ color:totais.entrada-totais.saida>=0?"#38bdf8":"#f87171", fontWeight:800, fontSize:14, marginTop:2 }}>{fmtMoeda(totais.entrada-totais.saida)}</div></div>
        </div>
      </div>

      <div style={{ background:"#1e293b", borderRadius:16, padding:"16px", marginBottom:16 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          {[["todos","Todos"],["entrada","Entradas"],["saida","Saídas"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFiltros(p=>({...p,tipo:v}))}
              style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${filtros.tipo===v?"#38bdf8":"#334155"}`, background: filtros.tipo===v?"#38bdf815":"transparent", color: filtros.tipo===v?"#38bdf8":"#64748b", fontSize:12, cursor:"pointer" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <input type="month" value={filtros.mes} onChange={e=>setFiltros(p=>({...p,mes:e.target.value}))}
            style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"8px 10px", color:"#f1f5f9", fontSize:12, outline:"none" }} />
          <input type="date" value={filtros.dataInicio} onChange={e=>setFiltros(p=>({...p,dataInicio:e.target.value}))}
            style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"8px 10px", color:"#f1f5f9", fontSize:12, outline:"none" }} />
          <input type="date" value={filtros.dataFim} onChange={e=>setFiltros(p=>({...p,dataFim:e.target.value}))}
            style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"8px 10px", color:"#f1f5f9", fontSize:12, outline:"none" }} />
          <select value={filtros.categoria} onChange={e=>setFiltros(p=>({...p,categoria:e.target.value}))}
            style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"8px 10px", color:"#f1f5f9", fontSize:12, outline:"none" }}>
            <option value="">Todas categ.</option>
            <option value="mensalidade">Mensalidade</option>
            {CATEGORIAS.map(c=><option key={c} value={c}>{capFirst(c)}</option>)}
          </select>
        </div>
      </div>

      {allItems.length===0
        ? <div style={{ textAlign:"center", color:"#64748b", marginTop:40, fontSize:14 }}>Nenhum registro encontrado</div>
        : <div style={{ background:"#1e293b", borderRadius:16, overflow:"hidden" }}>
            {allItems.map((item,i)=>(
              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderBottom: i<allItems.length-1?"1px solid #0f172a":"none" }}>
                <div style={{ width:36, height:36, borderRadius:10, background: item.tipo==="entrada"?"#10b98122":"#ef444422", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Icon name={item.tipo==="entrada"?"arrow_up":"arrow_down"} size={16} color={item.tipo==="entrada"?"#34d399":"#f87171"} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:"#f1f5f9", fontWeight:500, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.descricao}</div>
                  <div style={{ display:"flex", gap:6, marginTop:2, alignItems:"center" }}>
                    <span style={{ color:"#64748b", fontSize:11 }}>{fmtData(item.data)}</span>
                    {item.sub&&<span style={{ background:"#334155", color:"#94a3b8", borderRadius:4, padding:"1px 6px", fontSize:10 }}>{item.sub}</span>}
                  </div>
                </div>
                <span style={{ color: item.tipo==="entrada"?"#34d399":"#f87171", fontWeight:700, fontSize:14, flexShrink:0 }}>
                  {item.tipo==="saida"?"-":"+"}{fmtMoeda(item.valor)}
                </span>
              </div>
            ))}
          </div>
      }
    </div>
  );
};

// ============================================================
// APP ROOT
// ============================================================
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedCasa, setSelectedCasa] = useState(null);
  const [moradores, setMoradores] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [financeiro, setFinanceiro] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const toast = (msg, type="success") => {
    const id = Date.now();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3000);
  };

  const reload = useCallback(async () => {
    try {
      const [m,p,f] = await Promise.all([api.getMoradores(), api.getPagamentos(), api.getFinanceiro()]);
      setMoradores(m); setPagamentos(p); setFinanceiro(f);
    } catch(e) { toast("Erro ao carregar dados","error"); }
  }, []);

  useEffect(() => {
    setLoading(true);
    reload().finally(()=>setLoading(false));
  }, [reload]);

  const navigateTo = (p) => { setPage(p); if(p!=="casa_detalhe") setSelectedCasa(null); };

  const renderPage = () => {
    if (loading) return <Spinner />;
    switch(page) {
      case "dashboard":    return <Dashboard   moradores={moradores} pagamentos={pagamentos} financeiro={financeiro} />;
      case "casas":        return <Casas       moradores={moradores} pagamentos={pagamentos} setPage={navigateTo} setSelectedCasa={setSelectedCasa} />;
      case "casa_detalhe": return selectedCasa ? <CasaDetalhe casa={selectedCasa} pagamentos={pagamentos} setPage={navigateTo} toast={toast} reload={reload} /> : <Casas moradores={moradores} pagamentos={pagamentos} setPage={navigateTo} setSelectedCasa={setSelectedCasa} />;
      case "cadastro":     return <Cadastro    toast={toast} reload={reload} setPage={navigateTo} />;
      case "financeiro":   return <Financeiro  financeiro={financeiro} toast={toast} reload={reload} />;
      case "relatorios":   return <Relatorios  moradores={moradores} pagamentos={pagamentos} financeiro={financeiro} />;
      default:             return <Dashboard   moradores={moradores} pagamentos={pagamentos} financeiro={financeiro} />;
    }
  };

  return (
    <div style={{ background:"#0f172a", minHeight:"100vh", maxWidth:480, margin:"0 auto", fontFamily:"'Plus Jakarta Sans','DM Sans',system-ui,sans-serif", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing:border-box; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="month"]::-webkit-calendar-picker-indicator { filter:invert(1); }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#0f172a} ::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
      `}</style>
      <div style={{ overflowY:"auto", height:"100vh" }}>
        {renderPage()}
      </div>
      <BottomNav page={page} setPage={navigateTo} />
      <ToastList toasts={toasts} />
    </div>
  );
}
