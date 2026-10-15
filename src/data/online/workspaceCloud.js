import { apiFetch, cloudConfigured, getSession } from '../../cloud/cloudApi.js';
import { createWorkspaceRecordAdapter } from './workspaceRecordAdapter.mjs';
// Produção exige nuvem. Desenvolvimento local preserva os fluxos existentes.
export const cloudWorkspaceEnabled = () => import.meta.env.PROD || import.meta.env.VITE_WORKSPACE_CLOUD === 'true';
export const cloudWorkspaceConfigured = cloudConfigured;
export const workspaceRecords = kind => createWorkspaceRecordAdapter({ request: (path, options) => apiFetch(path, options, true), session: getSession, kind });
