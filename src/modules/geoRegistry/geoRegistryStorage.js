import { GEO_REGISTRY_STORAGE_KEY } from "./geoRegistryModel.mjs";

export function listGeoRegistryProjects() {
  try { const data = JSON.parse(localStorage.getItem(GEO_REGISTRY_STORAGE_KEY) || "[]"); return Array.isArray(data) ? data : []; } catch { return []; }
}
export function saveGeoRegistryProject(project) {
  const projects = listGeoRegistryProjects();
  const stored = { ...project, updatedAt: new Date().toISOString() };
  const index = projects.findIndex((item) => item.id === stored.id);
  if (index >= 0) projects[index] = stored; else projects.unshift(stored);
  localStorage.setItem(GEO_REGISTRY_STORAGE_KEY, JSON.stringify(projects));
  return stored;
}
export function deleteGeoRegistryProject(id) {
  localStorage.setItem(GEO_REGISTRY_STORAGE_KEY, JSON.stringify(listGeoRegistryProjects().filter((item) => item.id !== id)));
}
