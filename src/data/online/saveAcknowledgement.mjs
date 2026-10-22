// A confirmação do servidor corresponde ao snapshot enviado, não a edições
// posteriores que o usuário tenha feito enquanto aguardava a resposta.
export function applySaveAcknowledgement(current, submitted, stored) {
  if (!current || current.id !== submitted.id) return current;
  if (current === submitted) return stored;
  return { ...current, ...(stored.cloudRevision == null ? {} : { cloudRevision: stored.cloudRevision }) };
}
