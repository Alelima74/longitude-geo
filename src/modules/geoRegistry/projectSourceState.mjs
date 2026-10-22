export function applyMemorialData(project, parsed) {
  const clean = (object = {}) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== "" && value != null));
  const memorial = { property: clean(parsed.property), registry: clean(parsed.registry), sigef: clean(parsed.sigef), geodesy: clean(parsed.geodesy) };
  const mergeProperty = (current = {}, incoming = {}) => Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(incoming)])].map((key) => {
    const manuallyConfirmed = project.dataOrigins?.[`property.${key}`] === "PREENCHIMENTO MANUAL";
    return [key, manuallyConfirmed || incoming[key] === "" || incoming[key] == null ? current[key] : incoming[key]];
  }));
  return { ...project, memorial, memorialRegistry: memorial.registry, property: mergeProperty(project.property, memorial.property), sigef: { ...project.sigef, ...memorial.sigef }, geodesy: { ...project.geodesy, ...memorial.geodesy }, vertices: parsed.vertices?.length ? parsed.vertices : project.vertices, boundaries: parsed.boundaries?.length ? parsed.boundaries : project.boundaries };
}

export function applyRegistryData(project, registry) {
  return { ...project, registry: { ...project.registry, ...registry }, memorial: project.memorial, sigef: project.sigef, geometry: project.geometry, vertices: project.vertices, calculated: project.calculated };
}
