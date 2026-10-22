import React from "react";
function Block({ block }) {
  if (block.type === "paragraph") return <p>{block.content}</p>;
  if (block.type === "subheading") return <h2>{block.number} - {block.title}</h2>;
  if (block.type === "source") return <p className="ev-doc-source">{block.content}</p>;
  if (block.type === "formula") return <div className="ev-doc-formula">{block.content}</div>;
  if (block.type === "bullets") return <ul>{block.items.map(x => <li key={x}>{x}</li>)}</ul>;
  if (block.type === "figure") return <figure><div>{block.label}</div><figcaption>{block.caption}</figcaption></figure>;
  if (block.type === "status") return <div className={`ev-doc-status ${block.tone || ""}`}>{block.content}</div>;
  if (block.type === "signature") return <div className="ev-doc-sign"><span></span><strong>{block.name}</strong><small>{block.registration}</small></div>;
  if (block.type === "result") return <div className="ev-doc-result"><h2>{block.title}</h2>{block.items.map(([a,b]) => <div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div>;
  if (block.type === "table") return <div className="ev-doc-table">{block.caption && <em>{block.caption}</em>}<table><thead><tr>{block.headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{block.rows.map((r,i) => <tr key={i}>{r.map((c,j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>;
  return null;
}
function Sheet({ children, page }) { return <article className="ev-doc-sheet">{children}<footer>Longitude Geo Intelligence · Laudo técnico <span>Página {page}</span></footer></article>; }
export default function ReportDocumentPreview({ model }) {
  let page = 2;
  return <div className="ev-document-preview"><Sheet page={1}><div className="ev-doc-cover"><b>LONGITUDE GEO INTELLIGENCE</b><h1>{model.title}</h1><h2>{model.property?.name}</h2><p>{model.metadata.municipality}/{model.metadata.state}</p>{model.metadata.demo && <strong>DOCUMENTO DEMONSTRATIVO<br/>REVISÃO TÉCNICA OBRIGATÓRIA</strong>}</div></Sheet><Sheet page={page++}><h1>SUMÁRIO</h1><ol className="ev-doc-toc">{model.summary.map(s => <li key={s.id}><b>{s.number}</b><span>{s.title}</span></li>)}</ol></Sheet>{model.sections.map(section => <Sheet key={section.id} page={page++}><header className="ev-doc-section-head"><span>{section.number}</span><h1>{section.title}</h1>{section.manuallyEdited && <b>EDITADO MANUALMENTE</b>}</header>{section.blocks.map((block,i) => <Block key={`${section.id}-${i}`} block={block}/>)}</Sheet>)}</div>;
}
