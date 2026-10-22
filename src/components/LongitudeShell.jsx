import React from "react";
import logoLongitude from "../assets/logo-longitude.png";

const paths = {
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
  folder: <><path d="M3 6h6l2 2h10v11H3z"/><path d="M3 8V5h7l2 3"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  property: <><path d="M4 20V8l8-5 8 5v12"/><path d="M9 20v-6h6v6M2 20h20"/></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>,
  layers: <><path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  ruler: <><path d="M3 21 21 3l-5-1L2 16z"/><path d="m14 6 4 4M10 10l2 2M6 14l4 4"/></>,
  file: <><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></>,
  checklist: <><path d="M9 5h11M9 12h11M9 19h11"/><path d="m3 5 1 1 2-2M3 12l1 1 2-2M3 19l1 1 2-2"/></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21h-4v-.08A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3v-4h.08A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.08A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.18.38.42.72.74 1 .3.27.7.42 1.1.42H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.5 2.5 0 1 1 4.2 1.8c-1 .8-2 1.2-2 2.7M12 17h.01"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></>,
};

export function Icon({ name, className = "lg-icon" }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{paths[name] || paths.file}</svg>;
}

const groups = [
  ["Principal", [["dashboard", "home", "Início"], ["projetos", "folder", "Projetos"], ["clientes", "users", "Clientes"], ["imoveis", "property", "Imóveis"]]],
  ["Análise territorial", [["analise", "map", "Análise territorial"], ["integracoes", "layers", "SIGEF / CAR / INTERMAT"], ["cloud", "search", "Consulta territorial"]]],
  ["Cartório", [["averbacaoGeo", "ruler", "Averbação GEO"], ["evaluations", "file", "Laudos & Avaliações"], ["pecas", "file", "Peças Técnicas"], ["checklist", "checklist", "Checklist Cartorial"], ["dossies", "briefcase", "Dossiês"]]],
  ["Documentos", [["relatorios", "file", "Relatórios"], ["propostas", "briefcase", "Propostas"]]],
  ["Sistema", [["config", "settings", "Configurações"]]],
];

export function LongitudeSidebar({ active, onNavigate }) {
  const navigate = (target) => {
    if (["projetos", "checklist", "dossies"].includes(target)) onNavigate("averbacaoGeo", target === "checklist" ? "Checklist" : target === "dossies" ? "Peças Cartoriais" : "Visão Geral");
    else onNavigate(target);
  };
  return <aside className="longitude-sidebar">
    <div className="longitude-brand"><img src={logoLongitude} alt="Longitude"/><div><strong>Longitude Geo</strong><span>Intelligence</span></div></div>
    <nav className="longitude-nav" aria-label="Navegação principal">
      {groups.map(([title, items]) => <section className="longitude-nav-group" key={title}><h2>{title}</h2>{items.map(([id, icon, label]) => <button type="button" key={id} className={active === id ? "active" : ""} onClick={() => navigate(id)}><Icon name={icon}/><span>{label}</span></button>)}</section>)}
    </nav>
    <div className="longitude-sidebar-footer"><button type="button" className="lg-button" onClick={() => window.dispatchEvent(new Event("longitude:install"))}><Icon name="download"/><span>Instalar aplicativo</span></button></div>
  </aside>;
}

const titles = { dashboard: "Início", analise: "Análise territorial", clientes: "Clientes", imoveis: "Imóveis", integracoes: "SIGEF / CAR / INTERMAT", cloud: "Consulta territorial", pecas: "Peças Técnicas", evaluations: "Laudos & Avaliações", averbacaoGeo: "Averbação GEO", relatorios: "Relatórios", propostas: "Propostas", config: "Configurações" };

export function LongitudeHeader({ active, action, onAction }) {
  return <header className="longitude-header">
    <div className="longitude-breadcrumb"><span>Longitude Geo</span><span>/</span>{active === "averbacaoGeo" && <><span>Cartório</span><span>/</span></>}<strong>{titles[active] || "Plataforma"}</strong></div>
    <div className="longitude-header-actions">
      <label className="longitude-global-search"><Icon name="search"/><input aria-label="Pesquisa global" placeholder="Pesquisar imóvel, cliente ou processo..."/></label>
      {action && <button type="button" className="lg-button" onClick={onAction}>{action}</button>}
      <button type="button" className="lg-icon-button" aria-label="Ajuda"><Icon name="help"/></button>
      <button type="button" className="lg-icon-button" aria-label="Notificações"><Icon name="bell"/></button>
      <div className="longitude-user"><span className="longitude-avatar">AM</span><div><span>Alexandre</span><small>Administrador</small></div></div>
    </div>
  </header>;
}
