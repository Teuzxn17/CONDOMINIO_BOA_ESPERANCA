import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ============================================================
// SUPABASE
// ============================================================
const SUPABASE_URL = "https://sjvvckvqlornvjevgvku.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnZja3ZxbG9ybnZqZXZndmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NzE1MjIsImV4cCI6MjA5MDE0NzUyMn0.-tpGD7qR-C2Kbz6q4zJKLaIcFABbThfvbYntFGmYDSc";

const sb = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: opts.prefer || "return=representation", ...opts.headers },
    ...opts,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Erro Supabase"); }
  const t = await res.text(); return t ? JSON.parse(t) : [];
};

const api = {
  getMoradores:    ()      => sb("moradores?order=casa_id.asc"),
  addMorador:      (d)     => sb("moradores", { method: "POST", body: JSON.stringify(d) }),
  updateMorador:   (id, d) => sb(`moradores?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(d) }),
  deleteMorador:   (id)    => sb(`moradores?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
  getPagamentos:   ()      => sb("pagamentos?order=created_at.desc"),
  addPagamento:    (d)     => sb("pagamentos", { method: "POST", body: JSON.stringify(d) }),
  deletePagamento: (id)    => sb(`pagamentos?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
  getFinanceiro:    ()      => sb("financeiro?order=data.desc"),
  addFinanceiro:    (d)    => sb("financeiro", { method: "POST", body: JSON.stringify(d) }),
  updateFinanceiro: (id,d) => sb(`financeiro?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(d) }),
  deleteFinanceiro: (id)   => sb(`financeiro?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
};

// ============================================================
// CONSTANTS & DESIGN TOKENS
// ============================================================
const C = {
  bg: "#080e1a", card: "#0f1929", card2: "#162236",
  border: "#1c2e45", border2: "#243652",
  text: "#eef4ff", sub: "#7a9bbf", muted: "#3d5470",
  accent: "#3b82f6", accentD: "#1d4ed8",
  green: "#10b981", red: "#ef4444", yellow: "#f59e0b", purple: "#8b5cf6",
};

const STATUS = {
  pago:     { bg: C.green,  dim: "#10b98120", border: "#10b98140", label: "Pago",     emoji: "✅" },
  pendente: { bg: C.yellow, dim: "#f59e0b20", border: "#f59e0b40", label: "Pendente", emoji: "⏳" },
};

const FORMAS     = ["pix", "dinheiro", "debito", "credito"];
const CATEGORIAS = ["fixo", "variavel", "emergencial", "outro"];

// ============================================================
// HELPERS
// ============================================================
const R       = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (s) => s ? new Date(s + (s.includes("T") ? "" : "T12:00:00")).toLocaleDateString("pt-BR") : "-";
const cap     = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
const up      = (s) => s ? s.trim().toUpperCase() : s;

// Formato interno do mês: "MM-YYYY" (ex: "04-2026")
const buildMes    = (d) => { const x = new Date(d); return `${String(x.getMonth() + 1).padStart(2, "0")}-${x.getFullYear()}`; };
const getMesNow   = () => buildMes(new Date());
const parseMes    = (m) => { const [mm, yy] = m.split("-"); return new Date(+yy, +mm - 1, 1); };
const navMes      = (m, d) => { const x = parseMes(m); x.setMonth(x.getMonth() + d); return buildMes(x); };
const fmtMes      = (m) => { const [mm, yy] = m.split("-"); return new Date(+yy, +mm - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };
const fmtMesCurto = (m) => { const [mm, yy] = m.split("-"); return new Date(+yy, +mm - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };

// Converte "MM-YYYY" → "YYYY-MM" para uso em input type="month" e filtros ISO
const mesParaISO  = (m) => { const [mm, yy] = m.split("-"); return `${yy}-${mm}`; };
// Converte "YYYY-MM" → "MM-YYYY"
const isoParaMes  = (iso) => { const [yy, mm] = iso.split("-"); return `${mm}-${yy}`; };

// Status calculado SEMPRE dinamicamente pelo mês informado — nunca salvo no banco
const getStatus = (casaId, mes, pagamentos) =>
  pagamentos.some(p => p.casa_id === casaId && p.mes === (mes || getMesNow())) ? "pago" : "pendente";

// ============================================================
// VALIDAÇÕES
// ============================================================
const validarTel = (t) => /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(t.replace(/\s/g, ""));
const validarCPF = (c) => {
  if (!c || !c.trim()) return true;
  const n = c.replace(/\D/g, "");
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += +n[i] * (10 - i);
  let r = 11 - (s % 11); if (r >= 10) r = 0; if (r !== +n[9]) return false;
  s = 0; for (let i = 0; i < 10; i++) s += +n[i] * (11 - i);
  r = 11 - (s % 11); if (r >= 10) r = 0; return r === +n[10];
};
const maskTel = (v) => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 2) return n;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
};
const maskCPF = (v) => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
};

// WhatsApp
const waLink = (tel, nome, mes) => {
  const n = tel.replace(/\D/g, "");
  const fone = n.startsWith("55") ? n : `55${n}`;
  const msg = encodeURIComponent(`Olá Sr. ${cap(nome)}, tudo bem?

Referente ao Condomínio Boa Esperança, identificamos que a mensalidade de ${cap(fmtMes(mes))} encontra-se em aberto.

Para sua comodidade, o pagamento pode ser realizado via PIX:

🔑 Chave PIX: 91980630277

Solicitamos, por gentileza, a regularização o quanto antes para evitar possíveis encargos.

Caso já tenha efetuado o pagamento, pedimos que desconsidere esta mensagem.

Atenciosamente,
Administração
Condomínio Boa Esperança 🏘️`);
  return `https://wa.me/${fone}?text=${msg}`;
};

// ============================================================
// COMPONENTES BASE
// ============================================================

// Spinner inline
const SI = () => (
  <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
);

// Botão
const Btn = ({ children, onClick, v = "primary", sz = "md", loading = false, disabled = false, full = false, sx = {} }) => {
  const VS = {
    primary:  { background: `linear-gradient(135deg,${C.accent},${C.accentD})`, color: "#fff", border: "none" },
    success:  { background: `linear-gradient(135deg,${C.green},#059669)`, color: "#fff", border: "none" },
    danger:   { background: `${C.red}18`, color: "#f87171", border: `1px solid ${C.red}33` },
    ghost:    { background: "transparent", color: C.sub, border: `1px solid ${C.border2}` },
    whatsapp: { background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff", border: "none" },
  };
  const SZ = {
    sm: { padding: "6px 12px", fontSize: 12, borderRadius: 8 },
    md: { padding: "11px 18px", fontSize: 14, borderRadius: 12 },
    lg: { padding: "14px 20px", fontSize: 15, borderRadius: 14 },
  };
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{ ...VS[v], ...SZ[sz], fontWeight: 700, cursor: (disabled || loading) ? "default" : "pointer", opacity: (disabled || loading) ? .6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: full ? "100%" : "auto", fontFamily: "inherit", transition: "opacity .15s", ...sx }}>
      {loading ? <><SI /> Salvando...</> : children}
    </button>
  );
};

// Input
const Inp = ({ label, value, onChange, placeholder, type = "text", err, required, hint, ...rest }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ color: C.sub, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: .6 }}>
      {label}{required && <span style={{ color: C.red }}> *</span>}
    </label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{ width: "100%", background: C.card, border: `1.5px solid ${err ? C.red : C.border2}`, borderRadius: 12, padding: "11px 13px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
      onFocus={e => { if (!err) e.target.style.borderColor = C.accent; }}
      onBlur={e => { if (!err) e.target.style.borderColor = C.border2; }}
      {...rest} />
    {err  && <div style={{ color: C.red,   fontSize: 11, marginTop: 4 }}>⚠ {err}</div>}
    {hint && !err && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{hint}</div>}
  </div>
);

// Card
const Crd = ({ children, sx = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, ...sx }}>{children}</div>
);

// Status badge
const SBadge = ({ status, lg = false }) => {
  const s = STATUS[status] || STATUS.pendente;
  return (
    <span style={{ background: s.dim, color: s.bg, border: `1px solid ${s.border}`, borderRadius: 20, padding: lg ? "6px 14px" : "3px 9px", fontSize: lg ? 13 : 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {s.emoji} {s.label}
    </span>
  );
};

// Ícones
const Ic = ({ n, sz = 20, c = "currentColor" }) => {
  const P = {
    home:  "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    bldg:  "M1 21h22M5 21V7l7-4 7 4v14M9 21v-4h6v4",
    plus:  "M12 5v14M5 12h14",
    wlt:   "M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5M16 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    chrt:  "M18 20V10M12 20V4M6 20v-6",
    al:    "M15 18l-6-6 6-6",
    ar:    "M9 18l6-6-6-6",
    aup:   "M12 19V5M5 12l7-7 7 7",
    adn:   "M12 5v14M19 12l-7 7-7-7",
    chk:   "M20 6L9 17l-5-5",
    edt:   "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
    trs:   "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2",
    srch:  "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
    usr:   "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    flt:   "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
    ph:    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.88 9.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.99 0h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6.08 6.08l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
    dlr:   "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    bll:   "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  };
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={P[n] || ""} />
    </svg>
  );
};

// Toast
const ToastList = ({ toasts }) => (
  <div style={{ position: "fixed", bottom: 72, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, width: "92%", maxWidth: 420, pointerEvents: "none" }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        background: t.type === "error" ? "#1c0a0a" : t.type === "warn" ? "#1a1400" : "#091a10",
        border: `1.5px solid ${t.type === "error" ? C.red : t.type === "warn" ? C.yellow : C.green}`,
        color: t.type === "error" ? "#fca5a5" : t.type === "warn" ? "#fde68a" : "#86efac",
        padding: "13px 16px", borderRadius: 14, fontSize: 13, fontWeight: 600,
        boxShadow: "0 8px 32px rgba(0,0,0,.6)", animation: "slideUp .25s ease",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 15 }}>{t.type === "error" ? "❌" : t.type === "warn" ? "⚠️" : "✅"}</span>
        {t.msg}
      </div>
    ))}
  </div>
);

// Spinner de tela
const Spinner = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
    <div style={{ width: 38, height: 38, border: `3px solid ${C.border2}`, borderTop: `3px solid ${C.accent}`, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
    <div style={{ color: C.muted, fontSize: 13 }}>Carregando...</div>
  </div>
);

// NavMes
const NavMes = ({ mes, setMes }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 16px" }}>
    <button onClick={() => setMes(navMes(mes, -1))} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4, display: "flex" }}><Ic n="al" sz={18} c={C.accent} /></button>
    <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>📅 {cap(fmtMes(mes))}</span>
    <button onClick={() => setMes(navMes(mes, 1))}  style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4, display: "flex" }}><Ic n="ar" sz={18} c={C.accent} /></button>
  </div>
);

// ============================================================
// BOTTOM NAV
// ============================================================
const BottomNav = ({ page, setPage }) => {
  const tabs = [
    { id: "dashboard", ic: "home", lb: "Início" },
    { id: "casas",     ic: "bldg", lb: "Casas"  },
    { id: "cadastro",  ic: "plus", lb: ""        },
    { id: "financeiro",ic: "wlt",  lb: "Financ." },
    { id: "relatorios",ic: "chrt", lb: "Relat."  },
  ];
  return (
    <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 200, height: 62 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setPage(t.id)}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, border: "none", background: "none", cursor: "pointer", color: page === t.id ? C.accent : C.muted, padding: 0, fontFamily: "inherit", position: "relative" }}>
          {t.id === "cadastro"
            ? <div style={{ width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg,${C.accent},${C.accentD})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 14px ${C.accent}55`, marginTop: -10 }}>
                <Ic n="plus" sz={20} c="#fff" />
              </div>
            : <>
                <Ic n={t.ic} sz={19} c={page === t.id ? C.accent : C.muted} />
                <span style={{ fontSize: 9, fontWeight: page === t.id ? 700 : 400 }}>{t.lb}</span>
                {page === t.id && <div style={{ position: "absolute", bottom: 0, width: 18, height: 2, background: C.accent, borderRadius: 2 }} />}
              </>
          }
        </button>
      ))}
    </nav>
  );
};

// ============================================================
// HOUSE CARD
// ============================================================
const HouseCard = ({ morador, status, onClick, onWA }) => {
  const s = STATUS[status] || STATUS.pendente;
  return (
    <div onClick={onClick} style={{ background: C.card, border: `1px solid ${s.border}`, borderRadius: 16, padding: "13px 15px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "all .15s" }}
      onMouseEnter={e => { e.currentTarget.style.background = C.card2; }}
      onMouseLeave={e => { e.currentTarget.style.background = C.card; }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: s.dim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🏠</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cap(morador.nome)}</div>
        <div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>Casa {morador.casa_id}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        <SBadge status={status} />
        {status !== "pago" && morador.telefone && (
          <button onClick={e => { e.stopPropagation(); onWA(); }}
            style={{ background: "#25d36618", color: "#25d366", border: "1px solid #25d36635", borderRadius: 7, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
            <Ic n="ph" sz={10} c="#25d366" /> Cobrar
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================
// DASHBOARD
// ============================================================
const Dashboard = ({ moradores, pagamentos, financeiro }) => {
  const mes         = getMesNow();
  const inadimp     = moradores.filter(m => getStatus(m.casa_id, mes, pagamentos) !== "pago");
  const pagos       = moradores.filter(m => getStatus(m.casa_id, mes, pagamentos) === "pago");
  const recMes      = pagamentos.filter(p => p.mes === mes).reduce((a, p) => a + p.valor, 0);
  const totalRec    = pagamentos.reduce((a, p) => a + p.valor, 0);
  const totalEntradas = financeiro.filter(f => f.tipo === "entrada").reduce((a, f) => a + f.valor, 0);
  const totalSaidas = financeiro.filter(f => f.tipo === "saida").reduce((a, f) => a + f.valor, 0);
  const saldo       = totalRec + totalEntradas - totalSaidas;
  const pct         = moradores.length ? Math.round((pagos.length / moradores.length) * 100) : 0;

  const ultimos6    = Array.from({ length: 6 }, (_, i) => navMes(mes, -(5 - i)));
  const dataBarras  = ultimos6.map(m => ({
    mes:      fmtMesCurto(m),
    Pagos:    moradores.filter(mo => getStatus(mo.casa_id, m, pagamentos) === "pago").length,
    Pendentes:moradores.filter(mo => getStatus(mo.casa_id, m, pagamentos) !== "pago").length,
    Receita:  pagamentos.filter(p => p.mes === m).reduce((a, p) => a + p.valor, 0),
  }));

  return (
    <div style={{ padding: "20px 16px 88px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Painel do Gestor</div>
        <h1 style={{ color: C.text, fontSize: 26, fontWeight: 900, margin: "4px 0 2px" }}>Condomínio</h1>
        <div style={{ color: C.accent, fontSize: 13, fontWeight: 600 }}>📅 {cap(fmtMes(mes))}</div>
      </div>

      {/* Saldo */}
      <div style={{ background: "linear-gradient(135deg,#1d4ed8,#0284c7)", borderRadius: 20, padding: "22px 22px", marginBottom: 14, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />
        <div style={{ color: "rgba(255,255,255,.7)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Saldo Total Acumulado</div>
        <div style={{ color: "#fff", fontSize: 32, fontWeight: 900, margin: "6px 0 4px", letterSpacing: -1 }}>{R(saldo)}</div>
        <div style={{ color: "rgba(255,255,255,.55)", fontSize: 11 }}>Receitas ({R(totalRec + totalEntradas)}) − Despesas ({R(totalSaidas)})</div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {[
          { lb: "Casas",         val: moradores.length,  color: C.accent,  ic: "bldg", sub: "cadastradas"     },
          { lb: "Inadimplentes", val: inadimp.length,    color: C.red,     ic: "bll",  sub: "neste mês"        },
          { lb: "Pagos",         val: `${pagos.length}`, color: C.green,   ic: "chk",  sub: `${pct}% do total` },
          { lb: "Arrecadado",    val: R(recMes),         color: C.purple,  ic: "dlr",  sub: "em mensalidades"  },
        ].map(c => (
          <Crd key={c.lb} sx={{ border: `1px solid ${c.color}20`, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: C.muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: .8, marginBottom: 6 }}>{c.lb}</div>
                <div style={{ color: c.color, fontSize: 20, fontWeight: 900 }}>{c.val}</div>
                <div style={{ color: C.muted, fontSize: 10, marginTop: 3 }}>{c.sub}</div>
              </div>
              <div style={{ background: `${c.color}15`, borderRadius: 9, padding: 8 }}><Ic n={c.ic} sz={17} c={c.color} /></div>
            </div>
          </Crd>
        ))}
      </div>

      {/* Barra adimplência */}
      <Crd sx={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Adimplência do Mês</span>
          <span style={{ color: pct >= 70 ? C.green : pct >= 40 ? C.yellow : C.red, fontWeight: 800, fontSize: 15 }}>{pct}%</span>
        </div>
        <div style={{ background: C.border, borderRadius: 99, height: 7, overflow: "hidden" }}>
          <div style={{ background: `linear-gradient(90deg,${C.green},#34d399)`, height: "100%", width: `${pct}%`, borderRadius: 99 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
          <span style={{ color: C.green, fontSize: 11 }}>✅ {pagos.length} pagos</span>
          <span style={{ color: C.red, fontSize: 11 }}>⏳ {inadimp.length} pendentes</span>
        </div>
      </Crd>

      {/* Gráfico Receita */}
      <Crd sx={{ marginBottom: 12 }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginBottom: 14 }}>📈 Receita Mensal (últimos 6 meses)</div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={dataBarras} margin={{ top: 0, right: 0, bottom: 0, left: -25 }}>
            <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip formatter={v => [R(v), "Receita"]} contentStyle={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 10, color: C.text, fontSize: 12 }} cursor={{ fill: `${C.accent}10` }} />
            <Bar dataKey="Receita" fill={C.accent} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Crd>

      {/* Gráfico Adimplência */}
      <Crd sx={{ marginBottom: 12 }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginBottom: 14 }}>📊 Pagos vs Pendentes</div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={dataBarras} margin={{ top: 0, right: 0, bottom: 0, left: -25 }}>
            <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 10, color: C.text, fontSize: 12 }} />
            <Bar dataKey="Pagos"     fill={C.green}  radius={[4, 4, 0, 0]} />
            <Bar dataKey="Pendentes" fill={C.yellow} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Crd>

      {/* Lista inadimplentes */}
      {inadimp.length > 0 && (
        <Crd>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>⏳ Pendentes — {cap(fmtMes(mes))}</div>
          {inadimp.slice(0, 6).map((m, i) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: i < Math.min(inadimp.length, 6) - 1 ? `1px solid ${C.border}` : "none" }}>
              <div>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{cap(m.nome)}</div>
                <div style={{ color: C.muted, fontSize: 11 }}>Casa {m.casa_id}</div>
              </div>
              {m.telefone && (
                <a href={waLink(m.telefone, m.nome, mes)} target="_blank" rel="noreferrer"
                  style={{ background: "#25d36618", color: "#25d366", border: "1px solid #25d36635", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  <Ic n="ph" sz={11} c="#25d366" /> WhatsApp
                </a>
              )}
            </div>
          ))}
          {inadimp.length > 6 && <div style={{ color: C.muted, fontSize: 11, textAlign: "center", marginTop: 10 }}>+{inadimp.length - 6} outros pendentes</div>}
        </Crd>
      )}
    </div>
  );
};

// ============================================================
// CASAS
// ============================================================
const Casas = ({ moradores, pagamentos, setPage, setSelectedCasa }) => {
  const [mes, setMes]             = useState(getMesNow());
  const [busca, setBusca]         = useState("");
  const [filtroSt, setFiltroSt]   = useState("todos");

  const comSt   = moradores.map(m => ({ ...m, st: getStatus(m.casa_id, mes, pagamentos) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const buscados = comSt.filter(m => m.nome.toLowerCase().includes(busca.toLowerCase()) || m.casa_id.toLowerCase().includes(busca.toLowerCase()));
  const counts  = { pago: 0, pendente: 0 };
  buscados.forEach(m => { if (counts[m.st] !== undefined) counts[m.st]++; });
  const lista   = filtroSt === "todos" ? buscados : buscados.filter(m => m.st === filtroSt);

  return (
    <div style={{ padding: "20px 16px 88px" }}>
      <h1 style={{ color: C.text, fontSize: 22, fontWeight: 900, marginBottom: 14 }}>🏘️ Casas</h1>
      <div style={{ marginBottom: 10 }}><NavMes mes={mes} setMes={setMes} /></div>

      <div style={{ position: "relative", marginBottom: 10 }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Ic n="srch" sz={15} c={C.muted} /></div>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou casa..."
          style={{ width: "100%", background: C.card, border: `1px solid ${C.border2}`, borderRadius: 12, padding: "10px 12px 10px 38px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      </div>

      <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
        {[
          { k: "todos",    lb: `Todos (${buscados.length})`,         c: C.accent  },
          { k: "pago",     lb: `✅ Pagos (${counts.pago})`,          c: C.green   },
          { k: "pendente", lb: `⏳ Pendentes (${counts.pendente})`,  c: C.yellow  },
        ].map(b => (
          <button key={b.k} onClick={() => setFiltroSt(b.k)}
            style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1.5px solid ${filtroSt === b.k ? b.c : C.border}`, background: filtroSt === b.k ? `${b.c}18` : "transparent", color: filtroSt === b.k ? b.c : C.muted, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {b.lb}
          </button>
        ))}
      </div>

      {lista.length === 0
        ? <div style={{ textAlign: "center", color: C.muted, marginTop: 60 }}><div style={{ fontSize: 40, marginBottom: 10 }}>🏘️</div>Nenhuma casa encontrada</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {lista.map(m => (
              <HouseCard key={m.id} morador={m} status={m.st}
                onClick={() => { setSelectedCasa(m); setPage("casa_detalhe"); }}
                onWA={() => window.open(waLink(m.telefone, m.nome, mes), "_blank")} />
            ))}
          </div>
      }
    </div>
  );
};

// ============================================================
// CASA DETALHE — campo de edição extraído para evitar remount
// ============================================================
const EditField = ({ lb, value, onChange, type = "text", maxLength, inputMode }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>{lb}</div>
    <input
      type={type}
      value={value || ""}
      onChange={onChange}
      maxLength={maxLength}
      inputMode={inputMode}
      style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border2}`, borderRadius: 10, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
    />
  </div>
);

const CasaDetalhe = ({ casa, pagamentos, setPage, toast, reload }) => {
  const [edit,   setEdit]   = useState(false);
  const [edNome, setEdNome] = useState(casa.nome       || "");
  const [edTel,  setEdTel]  = useState(casa.telefone   || "");
  const [edCpf,  setEdCpf]  = useState(casa.cpf        || "");
  const [edQuad, setEdQuad] = useState(casa.quadra     || "");
  const [edNum,  setEdNum]  = useState(casa.numero_casa|| "");
  const [modal,  setModal]  = useState(false);
  const [saving, setSaving] = useState(false);
  const [pf,     setPf]     = useState({ valor: 0.00, forma: "pix", mes: getMesNow(), dt: new Date().toISOString().split("T")[0] });

  const pags  = pagamentos.filter(p => p.casa_id === casa.casa_id).sort((a, b) => new Date(b.data_pagamento) - new Date(a.data_pagamento));
  const stNow = getStatus(casa.casa_id, null, pagamentos);
  const s     = STATUS[stNow];

  // Mensagem WA com dados do recibo
  const waRecibo = (pag) => {
    const n    = tel.replace(/\D/g, "");
    const fone = n.startsWith("55") ? n : `55${n}`;
    const txt  = encodeURIComponent(
      `🧾 *Recibo de Pagamento*\n` +
      `Condomínio Boa Esperança\n\n` +
      `Morador: ${cap(casa.nome)}\n` +
      `Casa: ${casa.casa_id}\n` +
      `Mês: ${cap(fmtMes(pag.mes))}\n` +
      `Valor: ${R(pag.valor)}\n` +
      `Forma: ${cap(pag.forma_pagamento)}\n` +
      `Data: ${fmtData(pag.data_pagamento)}\n\n` +
      `✅ Pagamento confirmado.`
    );
    return `https://wa.me/${fone}?text=${txt}`;
  };

  const tel = casa.telefone || "";

  const salvarEdit = async () => {
    if (!edNome.trim() || !edTel.trim() || !edQuad.trim() || !edNum.trim()) { toast("Preencha todos os campos obrigatórios", "error"); return; }
    if (!/^[A-Za-z]$/.test(edQuad.trim())) { toast("Quadra deve ser uma única letra (A-Z)", "error"); return; }
    if (!/^\d{1,3}$/.test(edNum.trim()))   { toast("Número da casa deve ter até 3 dígitos", "error"); return; }
    setSaving(true);
    try {
      const q = edQuad.trim().toUpperCase();
      const n = edNum.trim();
      await api.updateMorador(casa.id, { nome: up(edNome), telefone: edTel.trim(), cpf: edCpf.trim() || null, quadra: q, numero_casa: n, casa_id: `${q}-${n}` });
      await reload(); setEdit(false); toast("Dados atualizados! ✅");
    } catch { toast("Erro ao atualizar", "error"); } finally { setSaving(false); }
  };

  const pagar = async () => {
    if (+pf.valor <= 0) { toast("Valor inválido", "error"); return; }
    setSaving(true);
    try {
      await api.addPagamento({ casa_id: casa.casa_id, mes: pf.mes, valor: +pf.valor, forma_pagamento: pf.forma, data_pagamento: new Date(pf.dt + "T12:00:00").toISOString() });
      await reload(); setModal(false); toast(`Pagamento de ${R(+pf.valor)} registrado! ✅`);
    } catch { toast("Erro ao registrar", "error"); } finally { setSaving(false); }
  };

  const delPag = async (id) => {
    if (!confirm("Excluir pagamento?")) return;
    try { await api.deletePagamento(id); await reload(); toast("Pagamento excluído.", "warn"); }
    catch { toast("Erro ao excluir", "error"); }
  };

  const delMorador = async () => {
    if (!confirm(`Excluir ${cap(casa.nome)}?`)) return;
    try { await api.deleteMorador(casa.id); await reload(); setPage("casas"); toast("Condômino removido.", "warn"); }
    catch { toast("Erro ao excluir", "error"); }
  };

  return (
    <div style={{ padding: "20px 16px 88px" }}>
      <button onClick={() => setPage("casas")} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13, padding: 0, marginBottom: 16, fontWeight: 600, fontFamily: "inherit" }}>
        <Ic n="al" sz={14} c={C.accent} /> Voltar
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 54, height: 54, borderRadius: 15, background: s.dim, border: `2px solid ${s.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🏠</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: C.text, fontSize: 19, fontWeight: 900, margin: 0 }}>{cap(casa.nome)}</h1>
          <div style={{ color: C.sub, fontSize: 12 }}>Casa {casa.casa_id}</div>
        </div>
        <SBadge status={stNow} lg />
      </div>

      {/* Ações rápidas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 }}>
        {stNow !== "pago" && (
          <Btn v="success" full sz="lg" onClick={() => setModal(true)}>✓ Marcar como Pago</Btn>
        )}
        {stNow !== "pago" && tel && (
          <a href={waLink(tel, casa.nome, getMesNow())} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg,#25d366,#128c7e)", borderRadius: 14, padding: "12px", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            <Ic n="ph" sz={17} c="#fff" /> Cobrar via WhatsApp
          </a>
        )}
      </div>

      {/* Dados do morador */}
      <Crd sx={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>👤 Dados do Morador</span>
          <div style={{ display: "flex", gap: 7 }}>
            {edit
              ? <><Btn v="success" sz="sm" loading={saving} onClick={salvarEdit}>Salvar</Btn><Btn v="ghost" sz="sm" onClick={() => setEdit(false)}>Cancelar</Btn></>
              : <><Btn v="ghost" sz="sm" onClick={() => setEdit(true)}><Ic n="edt" sz={13} c={C.accent} /></Btn><Btn v="danger" sz="sm" onClick={delMorador}><Ic n="trs" sz={13} c={C.red} /></Btn></>
            }
          </div>
        </div>

        {edit ? (
          <>
            <EditField lb="Nome"     value={edNome} onChange={e => setEdNome(e.target.value.toUpperCase())} />
            <EditField lb="Telefone" value={edTel}  onChange={e => setEdTel(maskTel(e.target.value))} />
            <EditField lb="CPF"      value={edCpf}  onChange={e => setEdCpf(maskCPF(e.target.value))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <EditField lb="Quadra (1 letra)"
                value={edQuad}
                onChange={e => { const v = e.target.value.replace(/[^A-Za-z]/g,"").slice(0,1).toUpperCase(); setEdQuad(v); }}
                maxLength={1}
              />
              <EditField lb="Nº Casa (máx 3 dígitos)"
                value={edNum}
                onChange={e => { const v = e.target.value.replace(/\D/g,"").slice(0,3); setEdNum(v); }}
                inputMode="numeric"
                maxLength={3}
              />
            </div>
          </>
        ) : (
          <>
            {[["Nome", casa.nome],["Telefone", casa.telefone],["CPF", casa.cpf],["Quadra", casa.quadra],["Nº Casa", casa.numero_casa]].map(([lb, val]) => (
              <div key={lb} style={{ marginBottom: 12 }}>
                <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>{lb}</div>
                <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{val || "—"}</div>
              </div>
            ))}
          </>
        )}
      </Crd>

      {/* Histórico de Pagamentos com botão Recibo */}
      <Crd>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📋 Histórico de Pagamentos</div>
        {pags.length === 0
          ? <div style={{ color: C.muted, textAlign: "center", padding: "20px 0", fontSize: 13 }}>Nenhum pagamento registrado</div>
          : pags.map((p, i) => (
            <div key={p.id} style={{ padding: "11px 0", borderBottom: i < pags.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{cap(fmtMes(p.mes))}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{fmtData(p.data_pagamento)} · {cap(p.forma_pagamento)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.green, fontWeight: 800, fontSize: 14 }}>{R(p.valor)}</span>
                  <button onClick={() => delPag(p.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex" }}><Ic n="trs" sz={13} c={C.red} /></button>
                </div>
              </div>
              {/* Botões de recibo — só para meses pagos */}
              <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                <button onClick={() => gerarRecibo(p, casa)}
                  style={{ flex: 1, background: `${C.accent}15`, color: C.accent, border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "6px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  🧾 Gerar Recibo (PDF)
                </button>
                {tel && (
                  <a href={waRecibo(p)} target="_blank" rel="noreferrer"
                    style={{ flex: 1, background: "#25d36615", color: "#25d366", border: "1px solid #25d36630", borderRadius: 8, padding: "6px 0", fontSize: 11, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <Ic n="ph" sz={11} c="#25d366" /> Enviar via WhatsApp
                  </a>
                )}
              </div>
            </div>
          ))
        }
      </Crd>

      {/* Modal Pagar */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "flex-end", zIndex: 300 }} onClick={() => setModal(false)}>
          <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: "22px 22px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 480, margin: "0 auto", boxSizing: "border-box" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: C.border2, borderRadius: 99, margin: "0 auto 20px" }} />
            <h2 style={{ color: C.text, fontSize: 17, fontWeight: 800, marginBottom: 18 }}>💳 Registrar Pagamento</h2>

            <div style={{ marginBottom: 12 }}>
              <label style={{ color: C.sub, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Mês de referência</label>
              <input type="month" value={mesParaISO(pf.mes)}
                onChange={e => setPf(p => ({ ...p, mes: isoParaMes(e.target.value) }))}
                style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border2}`, borderRadius: 11, padding: "10px 12px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ color: C.sub, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Valor (R$)</label>
              <input type="number" value={pf.valor} min="0" step="0.01" onChange={e => setPf(p => ({ ...p, valor: e.target.value }))}
                style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border2}`, borderRadius: 11, padding: "10px 12px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ color: C.sub, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Data do pagamento</label>
              <input type="date" value={pf.dt} onChange={e => setPf(p => ({ ...p, dt: e.target.value }))}
                style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border2}`, borderRadius: 11, padding: "10px 12px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
              <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Pré-preenchida com hoje. Altere se necessário.</div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ color: C.sub, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: .5 }}>Forma de pagamento</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {FORMAS.map(f => (
                  <button key={f} onClick={() => setPf(p => ({ ...p, forma: f }))}
                    style={{ padding: "10px", borderRadius: 10, border: `1.5px solid ${pf.forma === f ? C.accent : C.border2}`, background: pf.forma === f ? `${C.accent}18` : C.bg, color: pf.forma === f ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {f === "pix" ? "📱 Pix" : f === "dinheiro" ? "💵 Dinheiro" : f === "debito" ? "💳 Débito" : "💳 Crédito"}
                  </button>
                ))}
              </div>
            </div>

            <Btn v="success" full sz="lg" loading={saving} onClick={pagar}>
              Confirmar {R(+pf.valor || 0)}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// CADASTRO
// ============================================================
const Cadastro = ({ toast, reload, setPage }) => {
  const [nome,   setNome]   = useState("");
  const [tel,    setTel]    = useState("");
  const [cpf,    setCpf]    = useState("");
  const [quadra, setQuadra] = useState("");
  const [num,    setNum]    = useState("");
  const [erros,  setErros]  = useState({});
  const [saving, setSaving] = useState(false);

  const validar = () => {
    const e = {};
    if (!nome.trim())  e.nome = "Nome é obrigatório";
    if (!tel.trim())   e.tel  = "Telefone é obrigatório";
    else if (!validarTel(tel)) e.tel = "Formato inválido. Ex: (91) 99999-9999";
    if (cpf && !validarCPF(cpf)) e.cpf = "CPF inválido";
    if (!quadra.trim())              e.quadra = "Quadra obrigatória";
    else if (!/^[A-Z]$/.test(quadra)) e.quadra = "Apenas 1 letra (ex: A)";
    if (!num.trim())                 e.num = "Número obrigatório";
    else if (!/^\d{1,3}$/.test(num)) e.num = "Apenas números, máx 3 dígitos";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validar()) { toast("Corrija os campos destacados", "error"); return; }
    setSaving(true);
    try {
      await api.addMorador({ nome: up(nome), telefone: tel.trim(), cpf: cpf.trim() || null, quadra, numero_casa: num, casa_id: `${quadra}-${num}` });
      await reload();
      toast("Condômino cadastrado! 🎉");
      setNome(""); setTel(""); setCpf(""); setQuadra(""); setNum(""); setErros({});
      setPage("casas");
    } catch { toast("Erro ao cadastrar", "error"); } finally { setSaving(false); }
  };

  const IS = (err) => ({ width: "100%", background: C.bg, border: `1.5px solid ${err ? C.red : C.border2}`, borderRadius: 11, padding: "11px 13px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" });
  const LB = { color: C.sub, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 };

  return (
    <div style={{ padding: "20px 16px 88px" }}>
      <h1 style={{ color: C.text, fontSize: 22, fontWeight: 900, marginBottom: 4 }}>➕ Novo Condômino</h1>
      <p style={{ color: C.muted, fontSize: 12, marginBottom: 18 }}>Preencha os dados do morador</p>

      <Crd>
        <Inp label="Nome Completo" value={nome} onChange={e => { setNome(e.target.value.toUpperCase()); setErros(p => ({ ...p, nome: undefined })); }} placeholder="JOÃO DA SILVA" required err={erros.nome} />
        <Inp label="Telefone" value={tel} onChange={e => { setTel(maskTel(e.target.value)); setErros(p => ({ ...p, tel: undefined })); }} placeholder="(91) 99999-9999" required err={erros.tel} hint="Usado para cobranças via WhatsApp" />
        <Inp label="CPF (opcional)" value={cpf} onChange={e => { setCpf(maskCPF(e.target.value)); setErros(p => ({ ...p, cpf: undefined })); }} placeholder="000.000.000-00" err={erros.cpf} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Quadra: apenas 1 letra A-Z */}
          <div>
            <label style={LB}>Quadra <span style={{ color: C.red }}>*</span></label>
            <input
              value={quadra}
              onChange={e => { const v = e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase(); setQuadra(v); setErros(p => ({ ...p, quadra: undefined })); }}
              placeholder="A"
              maxLength={1}
              style={IS(erros.quadra)}
            />
            {erros.quadra && <div style={{ color: C.red, fontSize: 11, marginTop: 3 }}>⚠ {erros.quadra}</div>}
            {!erros.quadra && <div style={{ color: C.muted, fontSize: 10, marginTop: 3 }}>Somente 1 letra</div>}
          </div>

          {/* Número: apenas dígitos, máx 3 */}
          <div>
            <label style={LB}>Nº Casa <span style={{ color: C.red }}>*</span></label>
            <input
              value={num}
              onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 3); setNum(v); setErros(p => ({ ...p, num: undefined })); }}
              placeholder="01"
              maxLength={3}
              inputMode="numeric"
              style={IS(erros.num)}
            />
            {erros.num && <div style={{ color: C.red, fontSize: 11, marginTop: 3 }}>⚠ {erros.num}</div>}
            {!erros.num && <div style={{ color: C.muted, fontSize: 10, marginTop: 3 }}>Máx 3 dígitos</div>}
          </div>
        </div>

        {quadra && num && (
          <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}28`, borderRadius: 10, padding: "9px 13px", marginTop: 14, color: C.accent, fontSize: 13, fontWeight: 600 }}>
            🏠 ID: <strong>{quadra}-{num}</strong>
          </div>
        )}
      </Crd>

      <Btn v="primary" full sz="lg" loading={saving} onClick={submit} sx={{ marginTop: 14 }}>
        Cadastrar Condômino
      </Btn>
    </div>
  );
};

// ============================================================
// MODAL EDIÇÃO FINANCEIRO
// ============================================================
const ModalEditFinanceiro = ({ item, onSave, onClose, saving }) => {
  const [form, setForm] = useState({
    tipo:      item.tipo,
    descricao: item.descricao,
    valor:     item.valor,
    data:      item.data,
    categoria: item.categoria || "",
  });

  const IS = { width:"100%", background:C.bg, border:`1.5px solid ${C.border2}`, borderRadius:11, padding:"10px 12px", color:C.text, fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
  const LB = { color:C.sub, fontSize:11, fontWeight:700, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:.5 };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.82)", display:"flex", alignItems:"flex-end", zIndex:400 }} onClick={onClose}>
      <div style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:"22px 22px 0 0", padding:"24px 20px 32px", width:"100%", maxWidth:480, margin:"0 auto", boxSizing:"border-box" }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:36, height:4, background:C.border2, borderRadius:99, margin:"0 auto 18px" }}/>
        <div style={{ color:C.text, fontWeight:800, fontSize:17, marginBottom:18 }}>✏️ Editar Lançamento</div>

        {/* Tipo */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
          {["entrada","saida"].map(t=>(
            <button key={t} onClick={()=>setForm(p=>({...p,tipo:t}))}
              style={{ padding:"10px", borderRadius:11, border:`1.5px solid ${form.tipo===t?(t==="entrada"?C.green:C.red):C.border2}`, background:form.tipo===t?(t==="entrada"?`${C.green}18`:`${C.red}18`):C.bg, color:form.tipo===t?(t==="entrada"?C.green:C.red):C.muted, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              {t==="entrada"?"📈 Entrada":"📉 Saída"}
            </button>
          ))}
        </div>

        {/* Descrição */}
        <div style={{ marginBottom:12 }}>
          <label style={LB}>Descrição</label>
          <input value={form.descricao} onChange={e=>setForm(p=>({...p,descricao:e.target.value}))} style={IS}/>
        </div>

        {/* Valor + Data */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:12 }}>
          <div>
            <label style={LB}>Valor (R$)</label>
            <input type="number" value={form.valor} min="0" step="0.01" onChange={e=>setForm(p=>({...p,valor:e.target.value}))} style={IS}/>
          </div>
          <div>
            <label style={LB}>Data</label>
            <input type="date" value={form.data} onChange={e=>setForm(p=>({...p,data:e.target.value}))} style={IS}/>
          </div>
        </div>

        {/* Categoria */}
        <div style={{ marginBottom:18 }}>
          <label style={LB}>Categoria</label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["",...CATEGORIAS].map(c=>(
              <button key={c} onClick={()=>setForm(p=>({...p,categoria:c}))}
                style={{ padding:"5px 11px", borderRadius:7, border:`1px solid ${form.categoria===c?C.accent:C.border2}`, background:form.categoria===c?`${C.accent}18`:"transparent", color:form.categoria===c?C.accent:C.muted, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                {c||"Nenhuma"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
          <Btn v="ghost" full sz="md" onClick={onClose}>Cancelar</Btn>
          <Btn v="primary" full sz="md" loading={saving} onClick={()=>onSave(form)}>Salvar</Btn>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// FINANCEIRO
// ============================================================
const Financeiro = ({ financeiro, toast, reload }) => {
  const [form,     setForm]     = useState({ tipo: "entrada", descricao: "", valor: "", data: new Date().toISOString().split("T")[0], categoria: "" });
  const [filtros,  setFiltros]  = useState({ tipo: "todos", mes: "", dataInicio: "", dataFim: "", categoria: "" });
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [erros,    setErros]    = useState({});
  const [editItem, setEditItem] = useState(null); // item sendo editado

  const validar = () => {
    const e = {};
    if (!form.descricao.trim()) e.desc = "Descrição obrigatória";
    if (!form.valor || +form.valor <= 0) e.valor = "Valor deve ser > 0";
    if (!form.data)  e.data = "Data obrigatória";
    setErros(e); return Object.keys(e).length === 0;
  };

  const add = async () => {
    if (!validar()) { toast("Corrija os campos", "error"); return; }
    setSaving(true);
    try {
      await api.addFinanceiro({ ...form, descricao: up(form.descricao), valor: +form.valor });
      await reload();
      toast(`${form.tipo === "entrada" ? "Entrada" : "Saída"} registrada! ✅`);
      setForm({ tipo: "entrada", descricao: "", valor: "", data: new Date().toISOString().split("T")[0], categoria: "" });
      setShowForm(false); setErros({});
    } catch { toast("Erro ao salvar", "error"); } finally { setSaving(false); }
  };

  const salvarEdicao = async (form) => {
    if (!form.descricao.trim() || !form.valor || +form.valor <= 0 || !form.data) { toast("Preencha todos os campos", "error"); return; }
    setSaving(true);
    try {
      await api.updateFinanceiro(editItem.id, { ...form, descricao: up(form.descricao), valor: +form.valor });
      await reload(); setEditItem(null); toast("Lançamento atualizado! ✅");
    } catch { toast("Erro ao editar", "error"); } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("Excluir movimentação?")) return;
    try { await api.deleteFinanceiro(id); await reload(); toast("Excluído.", "warn"); }
    catch { toast("Erro ao excluir", "error"); }
  };

  const filtrado = financeiro.filter(f => {
    if (filtros.tipo !== "todos" && f.tipo !== filtros.tipo) return false;
    if (filtros.categoria && f.categoria !== filtros.categoria) return false;
    const d = new Date(f.data + "T12:00:00");
    if (filtros.mes) { const [y, m] = filtros.mes.split("-"); if (d.getFullYear() !== +y || d.getMonth() + 1 !== +m) return false; }
    if (filtros.dataInicio && d < new Date(filtros.dataInicio + "T00:00:00")) return false;
    if (filtros.dataFim    && d > new Date(filtros.dataFim + "T23:59:59"))    return false;
    return true;
  }).sort((a, b) => new Date(b.data) - new Date(a.data));

  const tot = filtrado.reduce((a, f) => { a[f.tipo] += f.valor; return a; }, { entrada: 0, saida: 0 });

  const limparFiltros = () => setFiltros({ tipo: "todos", mes: "", dataInicio: "", dataFim: "", categoria: "" });
  const filtroAtivo = filtros.mes || filtros.dataInicio || filtros.dataFim || filtros.categoria || filtros.tipo !== "todos";

  return (
    <div style={{ padding: "20px 16px 88px" }}>
      {editItem && <ModalEditFinanceiro item={editItem} onSave={salvarEdicao} onClose={()=>setEditItem(null)} saving={saving}/>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ color: C.text, fontSize: 22, fontWeight: 900, margin: 0 }}>💰 Financeiro</h1>
        <Btn v="primary" sz="sm" onClick={() => setShowForm(!showForm)}>
          <Ic n="plus" sz={14} c="#fff" /> {showForm ? "Fechar" : "Novo"}
        </Btn>
      </div>

      {/* Resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginBottom: 14 }}>
        {[
          { lb: "Entradas", val: tot.entrada, c: C.green  },
          { lb: "Saídas",   val: tot.saida,   c: C.red    },
          { lb: "Saldo",    val: tot.entrada - tot.saida, c: tot.entrada - tot.saida >= 0 ? C.accent : C.red },
        ].map(x => (
          <Crd key={x.lb} sx={{ padding: "11px 10px", textAlign: "center", border: `1px solid ${x.c}20` }}>
            <div style={{ color: C.muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>{x.lb}</div>
            <div style={{ color: x.c, fontSize: 12, fontWeight: 800, marginTop: 5 }}>{R(x.val)}</div>
          </Crd>
        ))}
      </div>

      {/* Formulário novo lançamento */}
      {showForm && (
        <Crd sx={{ marginBottom: 14 }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Nova Movimentação</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {["entrada", "saida"].map(t => (
              <button key={t} onClick={() => setForm(p => ({ ...p, tipo: t }))}
                style={{ padding: "10px", borderRadius: 11, border: `1.5px solid ${form.tipo === t ? (t === "entrada" ? C.green : C.red) : C.border2}`, background: form.tipo === t ? (t === "entrada" ? `${C.green}18` : `${C.red}18`) : C.bg, color: form.tipo === t ? (t === "entrada" ? C.green : C.red) : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {t === "entrada" ? "📈 Entrada" : "📉 Saída"}
              </button>
            ))}
          </div>
          <Inp label="Descrição" value={form.descricao} onChange={e => { setForm(p => ({ ...p, descricao: e.target.value })); setErros(p => ({ ...p, desc: undefined })); }} placeholder="EX: MANUTENÇÃO PORTÃO" required err={erros.desc} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <Inp label="Valor (R$)" value={form.valor} onChange={e => { setForm(p => ({ ...p, valor: e.target.value })); setErros(p => ({ ...p, valor: undefined })); }} type="number" required err={erros.valor} />
            <Inp label="Data" value={form.data} onChange={e => { setForm(p => ({ ...p, data: e.target.value })); setErros(p => ({ ...p, data: undefined })); }} type="date" required err={erros.data} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: C.sub, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 7, textTransform: "uppercase", letterSpacing: .5 }}>Categoria</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["", ...CATEGORIAS].map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, categoria: c }))}
                  style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${form.categoria === c ? C.accent : C.border2}`, background: form.categoria === c ? `${C.accent}18` : "transparent", color: form.categoria === c ? C.accent : C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {c || "Nenhuma"}
                </button>
              ))}
            </div>
          </div>
          <Btn v={form.tipo === "entrada" ? "success" : "danger"} full sz="md" loading={saving} onClick={add}>
            Registrar {form.tipo === "entrada" ? "Entrada" : "Saída"}{form.valor ? ` · ${R(+form.valor)}` : ""}
          </Btn>
        </Crd>
      )}

      {/* Filtros */}
      <Crd sx={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
          {[["todos", "Todos"], ["entrada", "📈 Entradas"], ["saida", "📉 Saídas"]].map(([v, l]) => (
            <button key={v} onClick={() => setFiltros(p => ({ ...p, tipo: v }))}
              style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1px solid ${filtros.tipo === v ? C.accent : C.border2}`, background: filtros.tipo === v ? `${C.accent}18` : "transparent", color: filtros.tipo === v ? C.accent : C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <input type="month" value={filtros.mes} onChange={e => setFiltros(p => ({ ...p, mes: e.target.value }))}
            style={{ background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "8px 9px", color: C.text, fontSize: 11, outline: "none", fontFamily: "inherit" }} />
          <select value={filtros.categoria} onChange={e => setFiltros(p => ({ ...p, categoria: e.target.value }))}
            style={{ background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "8px 9px", color: C.text, fontSize: 11, outline: "none", fontFamily: "inherit" }}>
            <option value="">Todas categ.</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{cap(c)}</option>)}
          </select>
          <input type="date" value={filtros.dataInicio} onChange={e => setFiltros(p => ({ ...p, dataInicio: e.target.value }))}
            style={{ background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "8px 9px", color: C.text, fontSize: 11, outline: "none", fontFamily: "inherit" }} />
          <input type="date" value={filtros.dataFim} onChange={e => setFiltros(p => ({ ...p, dataFim: e.target.value }))}
            style={{ background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "8px 9px", color: C.text, fontSize: 11, outline: "none", fontFamily: "inherit" }} />
        </div>
        {filtroAtivo && (
          <button onClick={limparFiltros} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", marginTop: 7, padding: 0, fontFamily: "inherit" }}>
            ✕ Limpar filtros
          </button>
        )}
      </Crd>

      {filtrado.length === 0
        ? <div style={{ textAlign: "center", color: C.muted, marginTop: 40, fontSize: 13 }}>Nenhuma movimentação encontrada</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtrado.map(f => (
              <div key={f.id} style={{ background: C.card, border: `1px solid ${f.tipo === "entrada" ? `${C.green}20` : `${C.red}20`}`, borderRadius: 14, padding: "13px 15px", display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: f.tipo === "entrada" ? `${C.green}15` : `${C.red}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                  {f.tipo === "entrada" ? "📈" : "📉"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.descricao}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                    <span style={{ color: C.muted, fontSize: 11 }}>{fmtData(f.data)}</span>
                    {f.categoria && <span style={{ background: C.border2, color: C.sub, borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 700 }}>{cap(f.categoria)}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: f.tipo === "entrada" ? C.green : C.red, fontWeight: 800, fontSize: 13 }}>{f.tipo === "saida" ? "-" : "+"}{R(f.valor)}</span>
                  <button onClick={() => setEditItem(f)} style={{ background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex" }}><Ic n="edt" sz={13} c={C.accent} /></button>
                  <button onClick={() => del(f.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex" }}><Ic n="trs" sz={13} c={C.red} /></button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
};

// ============================================================
// RECIBO (abre nova aba com layout de impressão)
// ============================================================
const gerarRecibo = (pag, morador) => {
  const nome  = morador ? cap(morador.nome) : "—";
  const quadra= morador ? morador.quadra    : "—";
  const casa  = morador ? morador.numero_casa:"—";
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Recibo — ${nome}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .recibo{background:#fff;border:2px solid #1e293b;border-radius:12px;width:100%;max-width:480px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)}
  .header{background:#1e293b;color:#fff;padding:24px;text-align:center}
  .header h1{font-size:20px;font-weight:800;margin-bottom:4px}
  .header p{font-size:12px;opacity:.7}
  .badge{display:inline-block;background:#10b981;color:#fff;border-radius:99px;padding:4px 14px;font-size:11px;font-weight:700;margin-top:10px;text-transform:uppercase;letter-spacing:1px}
  .body{padding:24px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
  .row:last-child{border-bottom:none}
  .label{color:#64748b;font-weight:600}
  .value{color:#0f172a;font-weight:700;text-align:right}
  .valor-destaque{font-size:28px;font-weight:900;color:#10b981;text-align:center;padding:20px 0 8px}
  .footer{background:#f8fafc;padding:16px 24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0}
  .assinatura{margin-top:40px;border-top:1px solid #cbd5e1;padding-top:10px;text-align:center;font-size:12px;color:#64748b}
  @media print{body{background:#fff}.recibo{box-shadow:none;border:2px solid #000}}
</style>
</head><body>
<div class="recibo">
  <div class="header">
    <h1>🏘️ Condomínio Boa Esperança</h1>
    <p>Recibo de Pagamento</p>
    <span class="badge">✓ Pago</span>
  </div>
  <div class="body">
    <div class="valor-destaque">${R(pag.valor)}</div>
    <div class="row"><span class="label">Morador</span><span class="value">${nome}</span></div>
    <div class="row"><span class="label">Quadra / Casa</span><span class="value">${quadra} - ${casa}</span></div>
    <div class="row"><span class="label">Mês de referência</span><span class="value">${cap(fmtMes(pag.mes))}</span></div>
    <div class="row"><span class="label">Data do pagamento</span><span class="value">${fmtData(pag.data_pagamento)}</span></div>
    <div class="row"><span class="label">Forma de pagamento</span><span class="value">${cap(pag.forma_pagamento)}</span></div>
    <div class="row"><span class="label">Descrição</span><span class="value">Mensalidade condominial</span></div>
    <div class="assinatura">
      <p>_________________________________</p>
      <p style="margin-top:6px">Assinatura do Administrador</p>
      <p style="margin-top:4px;font-size:10px">Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</p>
    </div>
  </div>
  <div class="footer">Este recibo comprova o pagamento da mensalidade referente ao período indicado.</div>
</div>
<script>setTimeout(()=>window.print(),400)</script>
</body></html>`;
  const w = window.open("","_blank");
  w.document.write(html);
  w.document.close();
};

// ============================================================
// EXPORTAÇÕES — PDF e Excel
// ============================================================
const exportarPDF = async (moradores, pagamentos, financeiro, filtros, titulo) => {
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  let y = 20;

  const addLine = (text, x, yy, size=10, bold=false, color=[0,0,0]) => {
    doc.setFontSize(size); doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setTextColor(...color); doc.text(text, x, yy);
  };
  const checkPage = () => { if (y > 270) { doc.addPage(); y = 20; } };

  // Determinar mês de referência para o relatório
  const mesRef = filtros.mes ? isoParaMes(filtros.mes) : getMesNow();
  const mesLabel = cap(fmtMes(mesRef));

  // Header
  doc.setFillColor(30, 41, 59); doc.rect(0, 0, pw, 30, "F");
  addLine("Condomínio Boa Esperança", pw/2, 11, 15, true, [255,255,255]);
  doc.setFontSize(9); doc.setTextColor(180,200,220);
  doc.text(titulo, pw/2, 18, { align:"center" });
  doc.text(`Período: ${mesLabel}   |   Gerado em ${new Date().toLocaleDateString("pt-BR")}`, pw/2, 24, { align:"center" });
  y = 40;

  // ─── Bloco Financeiro ─────────────────────────────────────
  addLine("RESUMO FINANCEIRO", 14, y, 11, true, [59,130,246]); y += 7;
  doc.setDrawColor(59,130,246); doc.line(14, y, pw-14, y); y += 6;

  const allItems = [
    ...pagamentos.map(p => {
      const m = moradores.find(x => x.casa_id === p.casa_id);
      return { tipo:"entrada", descricao:`Mensalidade — ${m ? cap(m.nome) : p.casa_id}`, valor:p.valor, data:p.data_pagamento?.split("T")[0]||"", mes:p.mes };
    }),
    ...financeiro.map(f => ({ ...f })),
  ].filter(i => {
    const d = new Date((i.data||"")+"T12:00:00");
    // Filtro por mês selecionado
    if (filtros.mes) { const [y2,m2]=filtros.mes.split("-"); if(d.getFullYear()!==+y2||d.getMonth()+1!==+m2) return false; }
    if (filtros.dataInicio && d<new Date(filtros.dataInicio+"T00:00:00")) return false;
    if (filtros.dataFim    && d>new Date(filtros.dataFim+"T23:59:59"))    return false;
    return true;
  });

  const tot = allItems.reduce((a,i)=>{ a[i.tipo]+=i.valor; return a; },{entrada:0,saida:0});
  addLine(`Entradas:  ${R(tot.entrada)}`, 14, y, 10, false, [16,185,129]); y += 6;
  addLine(`Saídas:    ${R(tot.saida)}`,   14, y, 10, false, [239,68,68]);  y += 6;
  addLine(`Saldo:     ${R(tot.entrada-tot.saida)}`, 14, y, 10, true, tot.entrada-tot.saida>=0?[59,130,246]:[239,68,68]); y += 10;

  // Tabela lançamentos
  addLine("LANÇAMENTOS DO PERÍODO", 14, y, 10, true, [100,116,139]); y += 6;
  const cols = [14, 50, 130, 158];
  doc.setFillColor(22,34,54); doc.rect(14, y-5, pw-28, 7, "F");
  addLine("Data", cols[0], y, 8, true, [200,220,240]);
  addLine("Descrição", cols[1], y, 8, true, [200,220,240]);
  addLine("Tipo", cols[2], y, 8, true, [200,220,240]);
  addLine("Valor", cols[3], y, 8, true, [200,220,240]);
  y += 6;

  allItems.sort((a,b)=>new Date(b.data)-new Date(a.data)).forEach((item,i)=>{
    checkPage();
    if(i%2===0){ doc.setFillColor(245,248,252); doc.rect(14,y-4,pw-28,6,"F"); }
    addLine(fmtData(item.data), cols[0], y, 8);
    addLine(item.descricao.slice(0,40), cols[1], y, 8);
    addLine(item.tipo==="entrada"?"Entrada":"Saída", cols[2], y, 8, false, item.tipo==="entrada"?[16,185,129]:[239,68,68]);
    addLine((item.tipo==="saida"?"-":"+")+R(item.valor), cols[3], y, 8, false, item.tipo==="entrada"?[16,185,129]:[239,68,68]);
    y += 6;
  });

  y += 8; checkPage();

  // ─── Bloco Moradores por Quadra — usando mesRef do filtro ──
  addLine(`STATUS POR QUADRA — ${mesLabel.toUpperCase()}`, 14, y, 11, true, [59,130,246]); y += 7;
  doc.setDrawColor(59,130,246); doc.line(14, y, pw-14, y); y += 6;

  const quadras = [...new Set(moradores.map(m=>m.quadra))].sort();
  quadras.forEach(q => {
    checkPage();
    addLine(`Quadra ${q}`, 14, y, 10, true, [148,163,184]); y += 6;
    moradores.filter(m=>m.quadra===q)
      .sort((a,b)=>a.numero_casa.localeCompare(b.numero_casa,"pt-BR",{numeric:true}))
      .forEach(m => {
        checkPage();
        // Status calculado com o mês do filtro — nunca fixo
        const st = getStatus(m.casa_id, mesRef, pagamentos);
        addLine(`Casa ${m.numero_casa}  ${cap(m.nome)}`, 18, y, 9);
        addLine(st==="pago"?"✓ Adimplente":"✗ Inadimplente", 148, y, 9, true, st==="pago"?[16,185,129]:[239,68,68]);
        y += 6;
      });
    y += 2;
  });

  doc.save(`relatorio-${mesRef.split("-").reverse().join("-")}.pdf`);
};

const exportarExcel = async (moradores, pagamentos, financeiro, filtros) => {
  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  // Mês de referência do filtro
  const mesRef  = filtros.mes ? isoParaMes(filtros.mes) : getMesNow();
  const mesISO  = filtros.mes || mesParaISO(getMesNow());

  // Filtro de lançamentos pelo mês
  const finFiltrado = financeiro.filter(f => {
    if (!filtros.mes) return true;
    const d = new Date(f.data+"T12:00:00");
    const [y2,m2] = filtros.mes.split("-");
    return d.getFullYear()===+y2 && d.getMonth()+1===+m2;
  });

  const pagFiltrado = pagamentos.filter(p => {
    if (!filtros.mes) return true;
    return p.mes === mesRef;
  });

  // Aba 1: Financeiro do período
  const rowsFin = [
    [`Financeiro — ${cap(fmtMes(mesRef))}`],
    ["Data","Tipo","Descrição","Categoria","Valor (R$)"],
    ...finFiltrado.map(f=>[fmtData(f.data), f.tipo==="entrada"?"Entrada":"Saída", f.descricao, f.categoria||"", f.valor]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsFin), "Financeiro");

  // Aba 2: Mensalidades do período
  const rowsPag = [
    [`Mensalidades — ${cap(fmtMes(mesRef))}`],
    ["Casa","Morador","Mês","Valor","Data Pagamento","Forma"],
    ...pagFiltrado.map(p=>{
      const m = moradores.find(x=>x.casa_id===p.casa_id);
      return [p.casa_id, m?cap(m.nome):"—", fmtMes(p.mes), p.valor, fmtData(p.data_pagamento), cap(p.forma_pagamento)];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsPag), "Mensalidades");

  // Aba 3: Status por morador — baseado no mesRef do filtro (dinâmico, nunca salvo)
  const rowsMor = [
    [`Status dos Moradores — ${cap(fmtMes(mesRef))}`],
    ["Casa","Quadra","Nº","Nome","Telefone",`Status ${cap(fmtMes(mesRef))}`],
    ...moradores.sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")).map(m=>[
      m.casa_id, m.quadra, m.numero_casa, cap(m.nome), m.telefone,
      // Status calculado dinamicamente pelo mês do filtro
      getStatus(m.casa_id, mesRef, pagamentos)==="pago" ? "Adimplente" : "Inadimplente",
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsMor), "Moradores");

  const nomeArq = filtros.mes
    ? `condominio-${filtros.mes}.xlsx`
    : `condominio-${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, nomeArq);
};

// ============================================================
// RELATÓRIOS
// ============================================================
const Relatorios = ({ moradores, pagamentos, financeiro }) => {
  const [aba,     setAba]     = useState("financeiro"); // financeiro | quadra | geral
  const [filtros, setFiltros] = useState({ tipo: "todos", mes: "", dataInicio: "", dataFim: "", categoria: "" });
  const [mesQuadra, setMesQuadra] = useState(getMesNow());
  const [exportando, setExportando] = useState(false);

  const getNome = (id) => moradores.find(m => m.casa_id === id)?.nome || id;

  // ── Dados financeiros ──────────────────────────────────────
  const allItems = [
    ...pagamentos.map(p => ({ id:p.id, tipo:"entrada", descricao:`MENSALIDADE — ${getNome(p.casa_id)} (${p.casa_id})`, valor:p.valor, data:p.data_pagamento?.split("T")[0]||"", categoria:"mensalidade", sub:cap(fmtMes(p.mes)), _pag:p })),
    ...financeiro.map(f => ({ ...f, sub:f.categoria?cap(f.categoria):undefined })),
  ].filter(i => {
    if (filtros.tipo !== "todos" && i.tipo !== filtros.tipo) return false;
    if (filtros.categoria && i.categoria !== filtros.categoria) return false;
    const d = new Date((i.data||"")+"T12:00:00");
    if (filtros.mes) { const [y,m]=filtros.mes.split("-"); if(d.getFullYear()!==+y||d.getMonth()+1!==+m) return false; }
    if (filtros.dataInicio && d<new Date(filtros.dataInicio+"T00:00:00")) return false;
    if (filtros.dataFim    && d>new Date(filtros.dataFim+"T23:59:59"))    return false;
    return true;
  }).sort((a,b)=>new Date(b.data)-new Date(a.data));

  const tot = allItems.reduce((a,i)=>{ a[i.tipo]+=i.valor; return a; },{entrada:0,saida:0});
  const grupos = allItems.reduce((acc,i)=>{ const k=i.data?.slice(0,7)||""; if(!acc[k]) acc[k]=[]; acc[k].push(i); return acc; },{});

  // ── Dados por quadra ───────────────────────────────────────
  const quadras = [...new Set(moradores.map(m=>m.quadra))].sort();

  const limpar = () => setFiltros({ tipo:"todos", mes:"", dataInicio:"", dataFim:"", categoria:"" });
  const filtroAtivo = filtros.mes||filtros.dataInicio||filtros.dataFim||filtros.categoria||filtros.tipo!=="todos";

  const handlePDF = async () => {
    setExportando(true);
    try { await exportarPDF(moradores, pagamentos, financeiro, filtros, "Relatório Geral"); }
    catch { alert("Erro ao gerar PDF"); }
    finally { setExportando(false); }
  };

  const handleExcel = async () => {
    setExportando(true);
    try { await exportarExcel(moradores, pagamentos, financeiro, filtros); }
    catch { alert("Erro ao gerar Excel"); }
    finally { setExportando(false); }
  };

  const IS11 = { background:C.bg, border:`1px solid ${C.border2}`, borderRadius:8, padding:"8px 9px", color:C.text, fontSize:11, outline:"none", fontFamily:"inherit" };

  return (
    <div style={{ padding:"20px 16px 88px" }}>
      <h1 style={{ color:C.text, fontSize:22, fontWeight:900, marginBottom:14 }}>📊 Relatórios</h1>

      {/* Botões exportação */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        <Btn v="danger" sz="sm" loading={exportando} onClick={handlePDF} sx={{ flex:1 }}>
          📄 Exportar PDF
        </Btn>
        <Btn v="success" sz="sm" loading={exportando} onClick={handleExcel} sx={{ flex:1 }}>
          📊 Exportar Excel
        </Btn>
      </div>

      {/* Abas */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {[["financeiro","💰 Financeiro"],["quadra","🏘️ Por Quadra"],["geral","📋 Geral"]].map(([k,l])=>(
          <button key={k} onClick={()=>setAba(k)}
            style={{ flex:1, padding:"8px 4px", borderRadius:10, border:`1.5px solid ${aba===k?C.accent:C.border}`, background:aba===k?`${C.accent}18`:"transparent", color:aba===k?C.accent:C.muted, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── ABA FINANCEIRO ─────────────────────────────── */}
      {aba==="financeiro" && (
        <>
          <Crd sx={{ marginBottom:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[{lb:"Entradas",val:tot.entrada,c:C.green},{lb:"Saídas",val:tot.saida,c:C.red},{lb:"Saldo",val:tot.entrada-tot.saida,c:tot.entrada-tot.saida>=0?C.accent:C.red}].map(x=>(
                <div key={x.lb} style={{ textAlign:"center", borderRight:x.lb!=="Saldo"?`1px solid ${C.border}`:"none", padding:"4px 0" }}>
                  <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>{x.lb}</div>
                  <div style={{ color:x.c, fontWeight:800, fontSize:13, marginTop:5 }}>{R(x.val)}</div>
                </div>
              ))}
            </div>
          </Crd>

          {/* Filtros */}
          <Crd sx={{ marginBottom:14 }}>
            <div style={{ display:"flex", gap:6, marginBottom:9 }}>
              {[["todos","Todos"],["entrada","📈 Ent."],["saida","📉 Saí."]].map(([v,l])=>(
                <button key={v} onClick={()=>setFiltros(p=>({...p,tipo:v}))}
                  style={{ flex:1, padding:"7px 4px", borderRadius:8, border:`1px solid ${filtros.tipo===v?C.accent:C.border2}`, background:filtros.tipo===v?`${C.accent}18`:"transparent", color:filtros.tipo===v?C.accent:C.muted, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
              <input type="month" value={filtros.mes} onChange={e=>setFiltros(p=>({...p,mes:e.target.value}))} style={IS11}/>
              <select value={filtros.categoria} onChange={e=>setFiltros(p=>({...p,categoria:e.target.value}))} style={IS11}>
                <option value="">Todas categ.</option>
                <option value="mensalidade">Mensalidade</option>
                {CATEGORIAS.map(c=><option key={c} value={c}>{cap(c)}</option>)}
              </select>
              <input type="date" value={filtros.dataInicio} onChange={e=>setFiltros(p=>({...p,dataInicio:e.target.value}))} style={IS11}/>
              <input type="date" value={filtros.dataFim}    onChange={e=>setFiltros(p=>({...p,dataFim:e.target.value}))}    style={IS11}/>
            </div>
            {filtroAtivo && <button onClick={limpar} style={{ background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", marginTop:7, padding:0, fontFamily:"inherit" }}>✕ Limpar filtros</button>}
          </Crd>

          {/* Extrato agrupado por mês */}
          {Object.keys(grupos).length===0
            ? <div style={{ textAlign:"center", color:C.muted, marginTop:40, fontSize:13 }}>Nenhum registro encontrado</div>
            : Object.entries(grupos).sort(([a],[b])=>b.localeCompare(a)).map(([chave,items])=>{
                const totG = items.reduce((a,i)=>{ a[i.tipo]+=i.valor; return a; },{entrada:0,saida:0});
                return (
                  <div key={chave} style={{ marginBottom:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <span style={{ color:C.sub, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>
                        {chave ? cap(fmtMes(chave.split("-").reverse().join("-"))) : "Sem data"}
                      </span>
                      <span style={{ color:totG.entrada-totG.saida>=0?C.green:C.red, fontSize:11, fontWeight:700 }}>
                        {totG.entrada-totG.saida>=0?"+":""}{R(totG.entrada-totG.saida)}
                      </span>
                    </div>
                    <Crd sx={{ padding:0, overflow:"hidden" }}>
                      {items.map((item,i)=>(
                        <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", background:i%2===0?C.card:C.card2, borderBottom:i<items.length-1?`1px solid ${C.border}`:"none" }}>
                          <div style={{ width:30, height:30, borderRadius:8, background:item.tipo==="entrada"?`${C.green}15`:`${C.red}15`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>
                            {item.tipo==="entrada"?"📈":"📉"}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ color:C.text, fontWeight:500, fontSize:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.descricao}</div>
                            <div style={{ display:"flex", gap:5, marginTop:2, alignItems:"center" }}>
                              <span style={{ color:C.muted, fontSize:10 }}>{fmtData(item.data)}</span>
                              {item.sub && <span style={{ background:C.border2, color:C.sub, borderRadius:3, padding:"1px 5px", fontSize:9, fontWeight:700 }}>{item.sub}</span>}
                            </div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                            <span style={{ color:item.tipo==="entrada"?C.green:C.red, fontWeight:800, fontSize:12 }}>
                              {item.tipo==="saida"?"-":"+"}{R(item.valor)}
                            </span>
                            {/* Botão recibo só para mensalidades */}
                            {item._pag && (
                              <button onClick={()=>{ const m=moradores.find(x=>x.casa_id===item._pag.casa_id); gerarRecibo(item._pag,m); }}
                                style={{ background:`${C.accent}18`, border:`1px solid ${C.accent}33`, borderRadius:6, padding:"3px 7px", fontSize:9, fontWeight:700, color:C.accent, cursor:"pointer", whiteSpace:"nowrap" }}>
                                🧾 Recibo
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </Crd>
                  </div>
                );
              })
          }
        </>
      )}

      {/* ── ABA POR QUADRA ─────────────────────────────── */}
      {aba==="quadra" && (
        <>
          <div style={{ marginBottom:14 }}><NavMes mes={mesQuadra} setMes={setMesQuadra}/></div>

          {/* Resumo */}
          {(() => {
            // Status calculado com o mês selecionado na navegação — não o mês atual
            const adim = moradores.filter(m=>getStatus(m.casa_id, mesQuadra, pagamentos)==="pago").length;
            const inad = moradores.length - adim;
            return (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginBottom:14 }}>
                {[{lb:"Total",val:moradores.length,c:C.accent},{lb:"Adimplentes",val:adim,c:C.green},{lb:"Inadimplentes",val:inad,c:C.red}].map(x=>(
                  <Crd key={x.lb} sx={{ padding:"11px 10px", textAlign:"center", border:`1px solid ${x.c}20` }}>
                    <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase" }}>{x.lb}</div>
                    <div style={{ color:x.c, fontSize:20, fontWeight:900, marginTop:5 }}>{x.val}</div>
                  </Crd>
                ))}
              </div>
            );
          })()}

          {quadras.map(q=>{
            const daCasa = moradores.filter(m=>m.quadra===q).sort((a,b)=>a.numero_casa.localeCompare(b.numero_casa,"pt-BR",{numeric:true}));
            const adimQ  = daCasa.filter(m=>getStatus(m.casa_id,mesQuadra,pagamentos)==="pago").length;
            return (
              <div key={q} style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ color:C.sub, fontWeight:800, fontSize:12, textTransform:"uppercase", letterSpacing:.5 }}>
                    🏘️ Quadra {q}
                  </span>
                  <span style={{ color:C.muted, fontSize:11 }}>{adimQ}/{daCasa.length} pagos</span>
                </div>
                <Crd sx={{ padding:0, overflow:"hidden" }}>
                  {daCasa.map((m,i)=>{
                    const st = getStatus(m.casa_id, mesQuadra, pagamentos); // usa o mês selecionado
                    return (
                      <div key={m.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", background:i%2===0?C.card:C.card2, borderBottom:i<daCasa.length-1?`1px solid ${C.border}`:"none" }}>
                        <div style={{ width:34, height:34, borderRadius:9, background:st==="pago"?`${C.green}15`:`${C.yellow}15`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                          🏠
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ color:C.text, fontWeight:600, fontSize:13 }}>{cap(m.nome)}</div>
                          <div style={{ color:C.muted, fontSize:11, marginTop:2 }}>Casa {m.numero_casa} · {m.telefone}</div>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
                          <span style={{ background:st==="pago"?`${C.green}18`:`${C.yellow}18`, color:st==="pago"?C.green:C.yellow, border:`1px solid ${st==="pago"?C.green:C.yellow}33`, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>
                            {st==="pago"?"✅ Adimplente":"⏳ Inadimplente"}
                          </span>
                          {st!=="pago" && m.telefone && (
                            <a href={waLink(m.telefone,m.nome,mesQuadra)} target="_blank" rel="noreferrer"
                              style={{ background:"#25d36615", color:"#25d366", border:"1px solid #25d36630", borderRadius:6, padding:"2px 7px", fontSize:9, fontWeight:700, textDecoration:"none" }}>
                              📱 WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Crd>
              </div>
            );
          })}
        </>
      )}

      {/* ── ABA GERAL ───────────────────────────────────── */}
      {aba==="geral" && (
        <>
          <Crd sx={{ marginBottom:14 }}>
            <div style={{ color:C.text, fontWeight:700, fontSize:14, marginBottom:12 }}>📋 Relatório Consolidado</div>
            <div style={{ color:C.sub, fontSize:12, lineHeight:1.7 }}>
              Este relatório reúne em um único PDF:<br/>
              • Resumo financeiro completo (entradas e saídas)<br/>
              • Lista de todos os lançamentos<br/>
              • Situação por quadra (adimplente / inadimplente)<br/>
            </div>
            <div style={{ marginTop:16 }}>
              <Btn v="danger" full sz="lg" loading={exportando} onClick={handlePDF}>
                📄 Gerar Relatório Geral em PDF
              </Btn>
            </div>
            <div style={{ marginTop:10 }}>
              <Btn v="success" full sz="lg" loading={exportando} onClick={handleExcel}>
                📊 Exportar Planilha Excel (3 abas)
              </Btn>
            </div>
          </Crd>

          {/* Preview resumo */}
          <Crd sx={{ marginBottom:14 }}>
            <div style={{ color:C.text, fontWeight:700, fontSize:13, marginBottom:12 }}>💰 Resumo Financeiro Total</div>
            {(()=>{
              const tRec  = pagamentos.reduce((a,p)=>a+p.valor,0);
              const tEnt  = financeiro.filter(f=>f.tipo==="entrada").reduce((a,f)=>a+f.valor,0);
              const tSai  = financeiro.filter(f=>f.tipo==="saida").reduce((a,f)=>a+f.valor,0);
              const saldo = tRec+tEnt-tSai;
              return [
                {lb:"Total mensalidades recebidas", val:R(tRec),     c:C.green },
                {lb:"Outras entradas",               val:R(tEnt),     c:C.green },
                {lb:"Total saídas",                  val:R(tSai),     c:C.red   },
                {lb:"Saldo acumulado",               val:R(saldo),    c:saldo>=0?C.accent:C.red, bold:true },
              ].map(x=>(
                <div key={x.lb} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ color:C.sub, fontSize:12 }}>{x.lb}</span>
                  <span style={{ color:x.c, fontWeight:x.bold?800:600, fontSize:12 }}>{x.val}</span>
                </div>
              ));
            })()}
          </Crd>

          <Crd>
            <div style={{ color:C.text, fontWeight:700, fontSize:13, marginBottom:12 }}>🏘️ Status — {cap(fmtMes(mesQuadra))}</div>
            {quadras.map(q=>{
              const daCasa = moradores.filter(m=>m.quadra===q);
              // Status calculado com o mês da aba Por Quadra — dinâmico
              const adim   = daCasa.filter(m=>getStatus(m.casa_id, mesQuadra, pagamentos)==="pago").length;
              return (
                <div key={q} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ color:C.sub, fontSize:12 }}>Quadra {q} ({daCasa.length} casas)</span>
                  <div style={{ display:"flex", gap:8, fontSize:11, fontWeight:700 }}>
                    <span style={{ color:C.green }}>✅ {adim}</span>
                    <span style={{ color:C.yellow }}>⏳ {daCasa.length-adim}</span>
                  </div>
                </div>
              );
            })}
          </Crd>
        </>
      )}
    </div>
  );
};

// ============================================================
// APP ROOT
// ============================================================
export default function App() {
  const [page,         setPage]        = useState("dashboard");
  const [selectedCasa, setSelectedCasa]= useState(null);
  const [moradores,    setMoradores]   = useState([]);
  const [pagamentos,   setPagamentos]  = useState([]);
  const [financeiro,   setFinanceiro]  = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [toasts,       setToasts]      = useState([]);

  const toast = useCallback((msg, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [m, p, f] = await Promise.all([api.getMoradores(), api.getPagamentos(), api.getFinanceiro()]);
      setMoradores(m); setPagamentos(p); setFinanceiro(f);
    } catch { toast("Erro ao carregar dados. Verifique a conexão.", "error"); }
  }, [toast]);

  useEffect(() => { setLoading(true); reload().finally(() => setLoading(false)); }, [reload]);

  const nav = (p) => { setPage(p); if (p !== "casa_detalhe") setSelectedCasa(null); };

  const renderPage = () => {
    if (loading) return <Spinner />;
    switch (page) {
      case "dashboard":    return <Dashboard    moradores={moradores} pagamentos={pagamentos} financeiro={financeiro} />;
      case "casas":        return <Casas        moradores={moradores} pagamentos={pagamentos} setPage={nav} setSelectedCasa={setSelectedCasa} />;
      case "casa_detalhe": return selectedCasa
        ? <CasaDetalhe casa={selectedCasa} pagamentos={pagamentos} setPage={nav} toast={toast} reload={reload} />
        : <Casas moradores={moradores} pagamentos={pagamentos} setPage={nav} setSelectedCasa={setSelectedCasa} />;
      case "cadastro":     return <Cadastro     toast={toast} reload={reload} setPage={nav} />;
      case "financeiro":   return <Financeiro   financeiro={financeiro} toast={toast} reload={reload} />;
      case "relatorios":   return <Relatorios   moradores={moradores} pagamentos={pagamentos} financeiro={financeiro} />;
      default:             return <Dashboard    moradores={moradores} pagamentos={pagamentos} financeiro={financeiro} />;
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 480, margin: "0 auto", fontFamily: "'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="month"]::-webkit-calendar-picker-indicator{filter:invert(.6)}
        @keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#243652;border-radius:4px}
        button{font-family:inherit}select option{background:#0f1929}
        a{-webkit-tap-highlight-color:transparent}button{-webkit-tap-highlight-color:transparent}
      `}</style>
      <div style={{ overflowY: "auto", height: "100vh" }}>
        {renderPage()}
      </div>
      <BottomNav page={page} setPage={nav} />
      <ToastList toasts={toasts} />
    </div>
  );
}
