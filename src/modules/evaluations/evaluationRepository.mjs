const KEY = "longitude_geo_evaluation_projects_v1";
import { cloudWorkspaceEnabled, workspaceRecords } from '../../data/online/workspaceCloud.js';
export function listEvaluationProjects() { if (cloudWorkspaceEnabled()) return workspaceRecords('evaluation').list(); try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
export function saveEvaluationProject(project) { if (cloudWorkspaceEnabled()) return workspaceRecords('evaluation').save(project); const next = { ...project, updatedAt: new Date().toISOString() }; const rows = listEvaluationProjects().filter((item) => item.id !== next.id); localStorage.setItem(KEY, JSON.stringify([next, ...rows])); return next; }
export function deleteEvaluationProject(id, revision) { if (cloudWorkspaceEnabled()) return workspaceRecords('evaluation').archive(id, revision); localStorage.setItem(KEY, JSON.stringify(listEvaluationProjects().filter((item) => item.id !== id))); }
