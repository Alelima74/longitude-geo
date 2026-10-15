export const REGIONAL_KNOWLEDGE_BASE = {
  "campos de júlio|mt": {
    municipality: "Campos de Júlio", state: "MT", source: "Base técnica demonstrativa Longitude; revisão documental obrigatória antes da emissão final", updatedAt: "01/08/2026", reviewedBy: "Equipe técnica Longitude",
    location: "O Município de Campos de Júlio situa-se no oeste do Estado de Mato Grosso e integra a região de influência do eixo rodoviário que articula o oeste mato-grossense aos principais centros de apoio, armazenagem e comercialização da produção rural. O território municipal apresenta ocupação marcadamente rural, com propriedades conectadas à sede por rodovias e por uma rede complementar de estradas vicinais.",
    pedology: "A caracterização pedológica regional deve ser interpretada em escala de reconhecimento. No contexto cadastrado para esta demonstração, predominam solos profundos e intemperizados, cujo uso agrícola depende de manejo técnico, correção de fertilidade e práticas conservacionistas. A confirmação da classe de solo do imóvel exige levantamento específico de campo.",
    relief: "O relevo regional é predominantemente plano a suavemente ondulado, condição que favorece a mecanização e a implantação de sistemas produtivos em maior escala. Variações locais de declividade e feições de drenagem devem ser verificadas por levantamento planialtimétrico e inspeção do imóvel.",
    vegetation: "O município encontra-se em área de transição e domínio de formações associadas ao Cerrado. A paisagem rural combina áreas produtivas consolidadas e remanescentes de vegetação nativa, cuja delimitação e enquadramento ambiental dependem dos documentos oficiais e da análise espacial de cada propriedade.",
    hydrography: "A rede hidrográfica regional é formada por cursos d'água e drenagens vinculados às bacias do oeste mato-grossense. A existência, posição e regime de corpos hídricos internos ao imóvel não são presumidos pela base municipal e devem ser confirmados mediante CAR, cartografia, imagens e vistoria.",
    economy: "A economia rural possui forte participação de lavouras mecanizadas, atividades pecuárias e serviços vinculados à cadeia agropecuária. A formação dos valores de terra é influenciada pela aptidão produtiva, condição de acesso, distância de estruturas de armazenagem, escala das áreas, situação documental e liquidez observada no mercado regional."
  },
  "nova lacerda|mt": {
    municipality: "Nova Lacerda", state: "MT", source: "Base técnica demonstrativa Longitude; revisão documental obrigatória antes da emissão final", updatedAt: "01/08/2026", reviewedBy: "Equipe técnica Longitude",
    location: "Nova Lacerda localiza-se no oeste do Estado de Mato Grosso e apresenta relações funcionais com os municípios do corredor regional de transportes. O acesso às áreas rurais combina ligação rodoviária e estradas vicinais, com condições operacionais variáveis segundo o trecho e a estação do ano.",
    pedology: "A base regional registra ocorrência de solos tropicais sujeitos a forte intemperismo. Aptidão, limitações e exigências de manejo não podem ser transferidas automaticamente para uma gleba individual sem análise de campo e documentação técnica.",
    relief: "A paisagem regional reúne superfícies planas a suavemente onduladas e setores localmente mais movimentados. Essa variação interfere na mecanização, conservação do solo, drenagem e aproveitamento econômico.",
    vegetation: "A cobertura regional reúne formações do Cerrado e áreas de transição, além de usos agropecuários consolidados. As áreas protegidas e remanescentes do imóvel são aquelas demonstradas nas bases ambientais analisadas.",
    hydrography: "A hidrografia municipal integra sistemas de drenagem do oeste mato-grossense. A avaliação não atribui curso d'água ao imóvel sem evidência cartográfica, cadastral ou de vistoria.",
    economy: "A estrutura econômica rural combina pecuária, agricultura e atividades de apoio. No mercado de terras, localização, logística, dimensão, percentual aproveitável, infraestrutura e segurança documental constituem atributos relevantes."
  },
  "comodoro|mt": {
    municipality: "Comodoro", state: "MT", source: "Base técnica demonstrativa Longitude; revisão documental obrigatória antes da emissão final", updatedAt: "01/08/2026", reviewedBy: "Equipe técnica Longitude",
    location: "Comodoro situa-se no oeste de Mato Grosso, em posição de conexão regional por rodovia federal e vias locais que atendem a extensa zona rural. A distância aos centros de apoio e a qualidade do acesso vicinal são variáveis relevantes na leitura econômica dos imóveis.",
    pedology: "A caracterização regional reconhece solos tropicais com diferentes níveis de aptidão e necessidade de manejo. A classificação aplicável ao imóvel deve resultar de dados técnicos próprios, sem extrapolação automática da escala municipal.",
    relief: "O município apresenta setores planos, suavemente ondulados e áreas de relevo mais movimentado. O enquadramento do imóvel considera apenas a topografia cadastrada e as evidências técnicas anexadas.",
    vegetation: "A vegetação regional integra formações do Cerrado e ambientes de transição. A situação ambiental de cada propriedade é definida pela análise conjunta de CAR, imagens, documentos e eventual vistoria.",
    hydrography: "A região possui rede de drenagem associada às bacias do oeste do Estado. Nenhuma feição hídrica interna é declarada apenas com base na descrição municipal.",
    economy: "A economia apresenta participação expressiva das atividades agropecuárias e dos serviços correlatos. Valores rurais variam conforme aptidão, acesso, infraestrutura, escala, uso consolidado, restrições e regularidade documental."
  }
};

export function getRegionalKnowledge(municipality, state) {
  return REGIONAL_KNOWLEDGE_BASE[`${String(municipality || "").trim().toLocaleLowerCase("pt-BR")}|${String(state || "").trim().toLocaleLowerCase("pt-BR")}`] || null;
}
