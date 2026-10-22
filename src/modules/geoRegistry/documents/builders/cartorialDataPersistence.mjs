export function confirmCartorialData(project, values, changedAt = new Date().toISOString()) {
  return { ...project, cartorialData: { ...(project.cartorialData || {}), ...Object.fromEntries(Object.entries(values).map(([key, fieldValue]) => [key, { value: fieldValue, source: "MANUAL_CONFIRMED", origin: "MANUAL_CONFIRMED", confirmed: true, updatedAt: changedAt }])) }, updatedAt: changedAt };
}

export function cartorialDraftFromContext(groups, context) {
  const read = (path) => path.split(".").reduce((result, key) => result?.[key], context);
  return Object.fromEntries(groups.flatMap(([, fields]) => fields).map(([, path]) => [path, read(path)?.value ?? ""]));
}
