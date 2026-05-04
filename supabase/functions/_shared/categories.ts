// Mantenha sincronizado com src/constants/financialData.ts (FIXED_CATEGORIES).
// Usado pela edge function add-transaction-by-phone para normalizar a categoria
// recebida (slug ou label) para o slug canônico antes do insert.
const FIXED: Array<{ value: string; label: string }> = [
  { value: "supermercado", label: "Supermercado" },
  { value: "restaurante", label: "Restaurante" },
  { value: "lanchonete", label: "Lanchonete / Fast Food" },
  { value: "padaria", label: "Padaria" },
  { value: "delivery", label: "Delivery / iFood" },
  { value: "acougue", label: "Açougue" },
  { value: "feira", label: "Feira / Hortifruti" },
  { value: "bebidas", label: "Bebidas" },
  { value: "aluguel", label: "Aluguel" },
  { value: "condominio", label: "Condomínio" },
  { value: "iptu", label: "IPTU" },
  { value: "energia_eletrica", label: "Energia Elétrica" },
  { value: "agua_esgoto", label: "Água e Esgoto" },
  { value: "gas", label: "Gás" },
  { value: "internet", label: "Internet" },
  { value: "tv_assinatura", label: "TV por Assinatura" },
  { value: "manutencao_casa", label: "Manutenção da Casa" },
  { value: "seguro_residencial", label: "Seguro Residencial" },
  { value: "combustivel", label: "Combustível" },
  { value: "estacionamento", label: "Estacionamento" },
  { value: "pedagio", label: "Pedágio" },
  { value: "uber_99_taxi", label: "Uber / 99 / Táxi" },
  { value: "transporte_publico", label: "Ônibus / Metrô" },
  { value: "seguro_veiculo", label: "Seguro do Veículo" },
  { value: "ipva", label: "IPVA" },
  { value: "manutencao_veiculo", label: "Manutenção do Veículo" },
  { value: "roupas", label: "Roupas" },
  { value: "calcados", label: "Calçados" },
  { value: "acessorios_vestuario", label: "Acessórios" },
  { value: "plano_saude", label: "Plano de Saúde" },
  { value: "farmacia", label: "Farmácia / Medicamentos" },
  { value: "consulta_medica", label: "Consulta Médica" },
  { value: "dentista", label: "Dentista" },
  { value: "exames_laboratorio", label: "Exames / Laboratório" },
  { value: "terapia_psicologo", label: "Terapia / Psicólogo" },
  { value: "academia_esporte", label: "Academia / Esporte" },
  { value: "escola_faculdade", label: "Escola / Faculdade" },
  { value: "curso_online", label: "Curso Online" },
  { value: "material_escolar", label: "Material Escolar" },
  { value: "livros", label: "Livros" },
  { value: "idiomas", label: "Idiomas" },
  { value: "treinamentos", label: "Treinamentos" },
  { value: "cinema_teatro", label: "Cinema / Teatro" },
  { value: "streaming", label: "Streaming (Netflix, etc.)" },
  { value: "jogos_games", label: "Jogos / Games" },
  { value: "viagens", label: "Viagens" },
  { value: "hospedagem", label: "Hospedagem" },
  { value: "passeios_parques", label: "Passeios / Parques" },
  { value: "shows_eventos", label: "Shows / Eventos" },
  { value: "hobbies", label: "Hobbies" },
  { value: "escola_filhos", label: "Escola dos Filhos" },
  { value: "material_filhos", label: "Material dos Filhos" },
  { value: "brinquedos", label: "Brinquedos" },
  { value: "baba_creche", label: "Babá / Creche" },
  { value: "mesada", label: "Mesada" },
  { value: "racao_petshop", label: "Ração / Pet Shop" },
  { value: "veterinario", label: "Veterinário" },
  { value: "banho_tosa", label: "Banho e Tosa" },
  { value: "acessorios_pet", label: "Acessórios Pet" },
  { value: "material_escritorio", label: "Material de Escritório" },
  { value: "coworking", label: "Coworking" },
  { value: "ferramentas_profissionais", label: "Ferramentas Profissionais" },
  { value: "uniforme_profissional", label: "Uniforme / Vestimenta Profissional" },
  { value: "celular_telefone", label: "Celular / Telefone" },
  { value: "assinaturas_digitais", label: "Assinaturas Digitais" },
  { value: "software_apps", label: "Software / Apps" },
  { value: "equipamentos_tech", label: "Equipamentos" },
  { value: "manutencao_eletronicos", label: "Manutenção de Eletrônicos" },
  { value: "tarifa_bancaria", label: "Tarifa Bancária" },
  { value: "pagamento_fatura", label: "Pagamento de Fatura" },
  { value: "anuidade_cartao", label: "Anuidade de Cartão" },
  { value: "emprestimo", label: "Empréstimo" },
  { value: "financiamento", label: "Financiamento" },
  { value: "consorcio", label: "Consórcio" },
  { value: "investimentos", label: "Investimentos" },
  { value: "previdencia_privada", label: "Previdência Privada" },
  { value: "seguros_vida", label: "Seguros (Vida, etc.)" },
  { value: "presentes", label: "Presentes" },
  { value: "cosmeticos_beleza", label: "Cosméticos / Beleza" },
  { value: "salao_barbearia", label: "Salão / Barbearia" },
  { value: "perfumaria", label: "Perfumaria" },
  { value: "eletronicos_pessoais", label: "Eletrônicos" },
  { value: "decoracao", label: "Decoração" },
  { value: "imposto_renda", label: "Imposto de Renda" },
  { value: "inss", label: "INSS" },
  { value: "taxas_governamentais", label: "Taxas Governamentais" },
  { value: "multas", label: "Multas" },
  { value: "cartorio_documentos", label: "Cartório / Documentos" },
  { value: "doacoes", label: "Doações" },
  { value: "dizimo_oferta", label: "Dízimo / Oferta" },
  { value: "contribuicao_sindical", label: "Contribuição Sindical" },
  { value: "musica_streaming", label: "Spotify / Música" },
  { value: "clube_assinatura", label: "Clube de Assinatura" },
  { value: "jornal_revista", label: "Jornal / Revista" },
  { value: "armazenamento_nuvem", label: "Armazenamento em Nuvem" },
  { value: "vpn_seguranca", label: "VPN / Segurança Digital" },
  { value: "emergencia_medica", label: "Despesas Médicas Emergenciais" },
  { value: "mudanca", label: "Mudança" },
  { value: "frete_correios", label: "Frete / Correios" },
  { value: "servicos_gerais", label: "Serviços (Encanador, Eletricista)" },
  { value: "outros", label: "Outros" },
  { value: "salario", label: "Salário" },
  { value: "freelance", label: "Freelance / Autônomo" },
  { value: "vendas", label: "Vendas" },
  { value: "aluguel_recebido", label: "Aluguel Recebido" },
  { value: "investimentos_rendimento", label: "Rendimento de Investimentos" },
  { value: "bonus", label: "Bônus / 13° Salário" },
  { value: "pensao_recebida", label: "Pensão Recebida" },
  { value: "comissao", label: "Comissão" },
  { value: "reembolso", label: "Reembolso" },
  { value: "presente_recebido", label: "Presente / Doação Recebida" },
  { value: "servico_prestado", label: "Serviço Prestado" },
  { value: "outros_receita", label: "Outras Receitas" },
  { value: "transferencia", label: "Transferência entre Contas" },
];

const SLUG_SET = new Set(FIXED.map((c) => c.value));
const LABEL_TO_SLUG = new Map<string, string>(
  FIXED.map((c) => [c.label.toLowerCase(), c.value]),
);

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

function stripEmojiPrefix(raw: string): string {
  let s = raw.normalize("NFKC").trimStart();
  let guard = 0;
  while (s.length > 0 && guard++ < 50) {
    const m = s.match(/^(\p{Extended_Pictographic}\uFE0F?)+/u);
    if (!m) break;
    s = s.slice(m[0].length).trimStart();
  }
  return s.trim();
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Aceita slug ou label e devolve o slug canônico. Mantém o input tratado
 * para categorias custom. Manter em sincronia com src/constants/financialData.ts.
 */
export function normalizeCategorySlug(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";
  const s0 = collapseSpaces(stripEmojiPrefix(input));
  if (!s0) return "";

  if (SLUG_SET.has(s0)) return s0;

  const lower = s0.toLowerCase();
  const exactLabel = LABEL_TO_SLUG.get(lower);
  if (exactLabel) return exactLabel;

  if (lower.length >= 8) {
    const candidates: string[] = [];
    for (const c of FIXED) {
      const lab = c.label.toLowerCase();
      if (Math.abs(lab.length - lower.length) > 1) continue;
      if (levenshteinDistance(lower, lab) <= 1) candidates.push(c.value);
    }
    if (candidates.length === 1) return candidates[0];
  }

  return s0;
}
