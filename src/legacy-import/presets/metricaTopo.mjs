export const METRICA_TOPO_PRESET = {
  id: "METRICA_TOPO_MDB",
  label: "Métrica TOPO / Banco legado Longitude",
  tables: {
    CadCliente: { entity: "clients", fields: { Codigo_Cliente:"legacy_id", Razao_Social:"corporate_name", Fantasia:"trade_name", CNPJ:"cpf_cnpj", Nome:"name", CPF:"cpf_cnpj", RG:"legacy_raw_data.rg", Endereco:"address", Cidade:"city", UF:"state", CEP:"legacy_raw_data.cep", Fone:"phone", Email:"email" } },
    CadEmpresa: { entity: "organizations / technical_professionals", fields: { Codigo_Empresa:"legacy_id", Razao_Social:"corporate_name", Fantasia:"name", CNPJ:"cnpj", Endereco:"address", Cidade:"city", UF:"state", CEP:"postal_code", Fone:"phone", Email:"email", Responsavel:"responsible_name", Qualificacao:"professional_qualification", CPF:"cpf", RG:"rg", CREA:"professional_registration", Codigo_Credenciado:"incra_credential", Tipo_Conselho:"professional_council_type" } },
    CadImovel: { entity: "properties", fields: { CodigoImovel:"legacy_id", NomeImovel:"name", Endereco:"address", BAIRRO:"district", Cidade:"municipality", Estado:"state", Incra:"sncr_incra", IPTU:"iptu", Lote:"lot", Quadra:"block", Cadastro:"municipal_registration", Area:"area_ha", Perimetro:"perimeter_m", Codigo_SIGEF:"sigef_code" } },
    CadMatricula: { entity: "registry_records", fields: { CodigoMatricula:"legacy_id", CodigoImovel:"property.legacy_id", Numero:"registration_number", Tipo:"registration_type", Folha:"page", Livro:"book", Comarca:"registry_district", Estado:"state", NomeCRI:"registry_office_name", CNS:"cns", NaturezaIterpa:"intermat_data.natureza", LocalizacaoIterpa:"intermat_data.localizacao", ComunidadeIterpa:"intermat_data.comunidade", GlebaIterpa:"intermat_data.gleba", ColoniaIterpa:"intermat_data.colonia", LotesIterpa:"intermat_data.lotes", Processositerpa:"intermat_data.processos", CodigoIterpa:"intermat_data.codigo", AreaAverbada:"historical_areas.area_averbada", AreadeAPP:"historical_areas.area_app", AreaDemarcada:"historical_areas.area_demarcada", AreaDeduzida:"historical_areas.area_deduzida", AreaLT:"historical_areas.area_lt" } },
    CadProprietario: { entity: "people / companies / property_owners", fields: { CodigoProp:"legacy_id", CodigoImovel:"property.legacy_id", NomeProp:"name", Nacionalidade:"nationality", Profissao:"profession", Endereco:"address", Cidade:"city", Estado:"state", RG:"rg", CPF_CIC:"cpf_cnpj", Est_Civil:"marital_status", Conjuge:"spouse_name", RG_Conjuge:"spouse_rg", CPF_CIC_Conjuge:"spouse_cpf", Reg_Uniao:"stable_union", TIPO:"person_type", orgexprop:"rg_issuer", Contato_CNPJ:"company_contact" } },
    CadServico: { entity: "survey_projects / service_orders", fields: { CodigoServico:"legacy_id", CodigoCliente:"client.legacy_id", Levantamento:"survey_type", Finalidade:"purpose", EquipUtilizado:"equipment", EquipeDeCampo:"field_team", EquipeDeEscritorio:"office_team", AreaAproximada:"approx_area", ART:"responsibility_number", Data:"service_date", Tipo_Responsabilidade:"responsibility_type" } },
  },
};

export const unmappedFields = (table) => {
  const mapped = METRICA_TOPO_PRESET.tables[table.name]?.fields || {};
  return table.columns.map((column)=>column.name).filter((name)=>!mapped[name]);
};
