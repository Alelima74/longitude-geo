import { useEffect, useRef, useState } from 'react';
import { cloudWorkspaceEnabled, workspaceRecords } from './workspaceCloud.js';

export function useWorkspaceData(readLocal, emptyData) {
  const online = cloudWorkspaceEnabled();
  const [data, setData] = useState(() => online ? structuredClone(emptyData) : readLocal());
  const [ready, setReady] = useState(!online), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const revision = useRef(null), current = useRef(data);
  const apply = next => { current.current = next; setData(next); };
  const reload = async () => {
    if (dirty && !window.confirm('Há alterações ainda não salvas. Deseja recarregar a versão da nuvem?')) return;
    setBusy(true);
    try {
      const rows = await workspaceRecords('workspace').list(), row = rows.find(item => item.id === 'main');
      revision.current = row?.cloudRevision ?? null;
      apply(row?.data || structuredClone(emptyData)); setDirty(false); setReady(true); setMessage('Base de trabalho carregada da nuvem.');
    } catch (error) { setMessage(`Erro ao carregar: ${error.message}`); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!online) return;
    let active = true;
    workspaceRecords('workspace').list().then(rows => {
      if (!active) return;
      const row = rows.find(item => item.id === 'main'); revision.current = row?.cloudRevision ?? null;
      apply(row?.data || structuredClone(emptyData)); setReady(true); setMessage('Base de trabalho carregada da nuvem.');
    }).catch(error => { if (active) setMessage(`Erro ao carregar: ${error.message}`); });
    return () => { active = false; };
  }, [online]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const update = value => {
    setData(previous => { const next = typeof value === 'function' ? value(previous) : value; current.current = next; return next; });
    setDirty(online);
  };
  const save = async () => {
    if (!ready || busy) return;
    setBusy(true); setMessage('Salvando base de trabalho...'); const snapshot = current.current;
    try {
      const saved = await workspaceRecords('workspace').save({ id: 'main', data: snapshot, ...(revision.current == null ? {} : { cloudRevision: revision.current }) });
      revision.current = saved.cloudRevision;
      setDirty(current.current !== snapshot); setMessage('Base de trabalho salva na nuvem.');
    } catch (error) { setMessage(`Erro ao salvar: ${error.message}`); }
    finally { setBusy(false); }
  };
  return [data, update, { online, ready, busy, dirty, message, save, reload }];
}
