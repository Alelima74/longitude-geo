import { deleteProjectFromStorage, listProjectsFromStorage, saveProjectToStorage } from "./geoRegistryStorageCore.mjs";
import { cloudWorkspaceEnabled, workspaceRecords } from '../../data/online/workspaceCloud.js';

export function listGeoRegistryProjects() {
  if (cloudWorkspaceEnabled()) return workspaceRecords('geo').list();
  return listProjectsFromStorage(localStorage);
}
export function saveGeoRegistryProject(project) {
  if (cloudWorkspaceEnabled()) return workspaceRecords('geo').save(project);
  return saveProjectToStorage(localStorage, project);
}
export function deleteGeoRegistryProject(id, revision) {
  if (cloudWorkspaceEnabled()) return workspaceRecords('geo').archive(id, revision);
  deleteProjectFromStorage(localStorage, id);
}
