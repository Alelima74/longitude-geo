import React from "react";
import { Icon } from "./LongitudeShell";
import "./longitude-dashboard.css";

function SummaryCard({ label, value, note, icon, tone = "brand" }) { return <article className="lg-card dashboard-summary"><span className={`dashboard-summary-icon ${tone}`}><Icon name={icon}/></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>; }

export default function LongitudeDashboard({ data, stats, onNavigate }) {
  const recent = (data?.imoveis || []).slice(0, 4);
  const analyses = (data?.analises || []).slice(0, 4);
  return <section className="longitude-page longitude-dashboard">
    <header className="dashboard-welcome"><div><span className="dashboard-eyebrow">SEGUNDA-FEIRA, 17 DE AGOSTO</span><h1>Bom dia, Alexandre</h1><p>Resumo das atividades da Longitude e dos processos territoriais em andamento.</p></div><button className="lg-button lg-button--primary" type="button" onClick={() => onNavigate("averbacaoGeo")}><span>+</span> Novo processo</button></header>
    <div className="dashboard-summary-grid">
      <SummaryCard label="Projetos ativos" value={stats?.imoveis || 0} note="Imóveis em acompanhamento" icon="folder"/>
      <SummaryCard label="Processos cartoriais" value={Math.max(stats?.analises || 0, 1)} note="Averbações em preparação" icon="ruler" tone="info"/>
      <SummaryCard label="Pendências" value={4} note="2 exigem sua atenção" icon="checklist" tone="warning"/>
      <SummaryCard label="Dossiês prontos" value={0} note="Aguardando conferência" icon="briefcase" tone="neutral"/>
    </div>
    <div className="dashboard-main-grid">
      <section className="lg-card dashboard-panel dashboard-projects"><header><div><h2>Projetos recentes</h2><p>Acompanhe os imóveis e processos acessados recentemente.</p></div><button type="button" onClick={() => onNavigate("imoveis")}>Ver todos</button></header>
        <div className="dashboard-project-list">{recent.length ? recent.map((item, index) => <button type="button" key={item.id || index} onClick={() => onNavigate("averbacaoGeo")}><span className="dashboard-property-icon"><Icon name="property"/></span><span><strong>{item.nome || item.name || "Imóvel sem denominação"}</strong><small>{item.municipio || item.municipality || "Município não informado"} • Matrícula {item.matricula || item.registration || "não informada"}</small></span><span className="lg-badge lg-badge--success">Em andamento</span><b>›</b></button>) : <div className="dashboard-feature-project"><span className="dashboard-property-icon"><Icon name="property"/></span><span><strong>CHÁCARA CANAÃ</strong><small>Nossa Senhora do Livramento • MT · Matrícula 103.328</small></span><span className="lg-badge lg-badge--success">Em andamento</span><b>›</b></div>}</div>
      </section>
      <section className="lg-card dashboard-panel dashboard-pending"><header><div><h2>Pendências importantes</h2><p>Itens que precisam de ação.</p></div></header><ul><li><span className="pending-dot warning"></span><div><strong>Documentos para conferência</strong><small>CHÁCARA CANAÃ · 4 itens pendentes</small></div><span>Hoje</span></li><li><span className="pending-dot info"></span><div><strong>Revisar dados cartoriais</strong><small>Confirmar matrícula e CNS</small></div><span>Hoje</span></li><li><span className="pending-dot neutral"></span><div><strong>Anuência de confrontante</strong><small>Aguardando documento assinado</small></div><span>3 dias</span></li></ul></section>
    </div>
    <div className="dashboard-lower-grid">
      <section className="lg-card dashboard-panel"><header><div><h2>Atividades recentes</h2><p>Últimas atualizações registradas na plataforma.</p></div></header><div className="dashboard-timeline">{analyses.length ? analyses.map((item, i) => <div key={item.id || i}><span></span><p><strong>{item.nome || "Análise territorial atualizada"}</strong><small>{item.data || "Atualização recente"}</small></p></div>) : <><div><span></span><p><strong>Checklist cartorial revisado</strong><small>CHÁCARA CANAÃ · há poucos minutos</small></p></div><div><span></span><p><strong>Projeto de Averbação GEO aberto</strong><small>Dados principais identificados · hoje</small></p></div></>}</div></section>
      <section className="lg-card dashboard-panel dashboard-quick"><header><div><h2>Ações rápidas</h2><p>Atalhos para tarefas frequentes.</p></div></header><div><button type="button" onClick={() => onNavigate("analise")}><Icon name="map"/><span><strong>Nova análise</strong><small>Importar perímetro</small></span></button><button type="button" onClick={() => onNavigate("averbacaoGeo")}><Icon name="ruler"/><span><strong>Averbação GEO</strong><small>Abrir processo</small></span></button><button type="button" onClick={() => onNavigate("clientes")}><Icon name="users"/><span><strong>Novo cliente</strong><small>Cadastrar dados</small></span></button></div></section>
    </div>
  </section>;
}
