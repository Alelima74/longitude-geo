export function createFileRepository({ client, organizationId, uuid = () => crypto.randomUUID() }) {
  const bucket = "longitude-private";
  return {
    async upload(file, { projectId, projectType, documentType, version = 1 }) {
      if (!["geo", "evaluation"].includes(projectType)) throw new Error("Tipo de projeto inválido.");
      if (!projectId || !documentType) throw new Error("Salve o projeto antes de enviar anexos.");
      if (!file?.size || file.size > 50 * 1024 * 1024) throw new Error("O arquivo deve ter entre 1 byte e 50 MB.");
      const org = await organizationId();
      const id = uuid();
      const originalName = file.name || "documento";
      const safeName = originalName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160);
      const path = `${org}/${projectType}/${projectId}/${id}/${safeName}`;
      const { error } = await client.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
      if (error) throw new Error("Erro ao enviar arquivo ao Storage. Nenhum salvamento local foi realizado.");
      const { data, error: metadataError } = await client.from("uploaded_files").insert({ id, organization_id: org,
        bucket, path, mime_type: file.type || "application/octet-stream", original_name: originalName,
        geo_project_id: projectType === "geo" ? projectId : null,
        evaluation_project_id: projectType === "evaluation" ? projectId : null,
        document_type: documentType, version, size_bytes: file.size }).select().single();
      if (metadataError) {
        // Never delete an uploaded user file automatically after a partial failure.
        throw new Error(`Arquivo enviado, mas metadados não foram salvos. Preserve este caminho para recuperação: ${path}`);
      }
      return data;
    },
    async open(fileId) {
      const org = await organizationId();
      const { data: file, error } = await client.from("uploaded_files").select("bucket,path").eq("id", fileId).eq("organization_id", org).single();
      if (error || !file) throw new Error("Arquivo não encontrado ou acesso negado.");
      const { data, error: signedError } = await client.storage.from(file.bucket).createSignedUrl(file.path, 60);
      if (signedError) throw new Error("Não foi possível abrir o arquivo privado.");
      return data.signedUrl;
    },
  };
}
