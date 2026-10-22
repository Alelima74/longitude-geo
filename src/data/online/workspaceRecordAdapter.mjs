const TABLE = '/rest/v1/longitude_workspace_records';
const conflict = () => new Error('Este registro foi alterado em outro aparelho. Suas edições continuam abertas. Exporte uma cópia antes de reabrir a versão da nuvem.');
export function assertCloudProject(project) {
  if (!project || typeof project !== 'object' || !project.id) throw new Error('Projeto sem identificação.');
  if (project.isDemo || project.sampleData || project.status === 'DEMO' || String(project.id).startsWith('exemplo-')) {
    throw new Error('Demonstrações não são salvas como dados reais na nuvem.');
  }
  if (/data:[^"\s]*;base64,/i.test(JSON.stringify(project))) throw new Error('Anexo incorporado: preserve o arquivo e envie-o ao armazenamento de documentos antes de salvar.');
}
export function createWorkspaceRecordAdapter({ request, session, kind }) {
  if (!['geo', 'evaluation', 'workspace', 'technical'].includes(kind)) throw new Error('Tipo de registro inválido.');
  const base = () => {
    if (!session()?.user?.id) throw new Error('Faça login para acessar seus projetos.');
    return `${TABLE}?kind=eq.${kind}&owner_id=eq.${encodeURIComponent(session().user.id)}`;
  };
  const unwrap = row => ({ ...row.payload, id: row.local_id, cloudRevision: row.revision, updatedAt: row.updated_at });
  const send = async (url, method, payload) => request(url, { method, headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  return {
    async list() {
      const url = base(), rows = []; let cursor = null;
      for (;;) {
        const page = await request(`${url}&archived=eq.false&order=local_id&limit=100${cursor === null ? '' : `&local_id=gt.${encodeURIComponent(cursor)}`}`);
        if (!Array.isArray(page)) throw new Error('Resposta de projetos inválida.');
        rows.push(...page.map(unwrap));
        if (page.length < 100) return rows;
        cursor = page.at(-1).local_id;
      }
    },
    async save(project) {
      assertCloudProject(project);
      if (kind === 'evaluation' && !project.cloudReviewConfirmed) throw new Error('Confira os dados do laudo e marque a confirmação de revisão antes de salvar na nuvem.');
      const url = base();
      const { cloudRevision, ...payload } = project;
      let rows;
      if (cloudRevision == null) {
        try { rows = await send(TABLE, 'POST', { kind, local_id: String(project.id), payload }); }
        catch (error) { if (error.status === 409 || error.body?.code === '23505') throw conflict(); throw error; }
      } else {
        if (!Number.isInteger(cloudRevision) || cloudRevision < 1) throw new Error('Revisão inválida. Preserve suas edições antes de reabrir o projeto.');
        rows = await send(`${url}&local_id=eq.${encodeURIComponent(project.id)}&revision=eq.${cloudRevision}&archived=eq.false`, 'PATCH', { payload });
      }
      if (!rows?.length) throw conflict();
      return unwrap(rows[0]);
    },
    async archive(id, revision) {
      if (!Number.isInteger(revision) || revision < 1) throw new Error('Atualize a lista antes de excluir.');
      const rows = await send(`${base()}&local_id=eq.${encodeURIComponent(id)}&revision=eq.${revision}&archived=eq.false`, 'PATCH', { archived: true });
      if (!rows?.length) throw conflict();
    },
  };
}
