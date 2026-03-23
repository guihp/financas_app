// ============================================
// 100 Categorias Fixas de Gastos Brasileiros
// ============================================

export interface CategoryItem {
    value: string;
    label: string;
    group: string;
    emoji: string;
    type: 'income' | 'expense' | 'both';
}

export const FIXED_CATEGORIES: CategoryItem[] = [
    // 🍽️ Alimentação
    { value: "supermercado", label: "Supermercado", group: "Alimentação", emoji: "🛒", type: "expense" },
    { value: "restaurante", label: "Restaurante", group: "Alimentação", emoji: "🍽️", type: "expense" },
    { value: "lanchonete", label: "Lanchonete / Fast Food", group: "Alimentação", emoji: "🍔", type: "expense" },
    { value: "padaria", label: "Padaria", group: "Alimentação", emoji: "🥐", type: "expense" },
    { value: "delivery", label: "Delivery / iFood", group: "Alimentação", emoji: "📦", type: "expense" },
    { value: "acougue", label: "Açougue", group: "Alimentação", emoji: "🥩", type: "expense" },
    { value: "feira", label: "Feira / Hortifruti", group: "Alimentação", emoji: "🥬", type: "expense" },
    { value: "bebidas", label: "Bebidas", group: "Alimentação", emoji: "🥤", type: "expense" },

    // 🏠 Moradia
    { value: "aluguel", label: "Aluguel", group: "Moradia", emoji: "🏠", type: "expense" },
    { value: "condominio", label: "Condomínio", group: "Moradia", emoji: "🏢", type: "expense" },
    { value: "iptu", label: "IPTU", group: "Moradia", emoji: "📋", type: "expense" },
    { value: "energia_eletrica", label: "Energia Elétrica", group: "Moradia", emoji: "⚡", type: "expense" },
    { value: "agua_esgoto", label: "Água e Esgoto", group: "Moradia", emoji: "💧", type: "expense" },
    { value: "gas", label: "Gás", group: "Moradia", emoji: "🔥", type: "expense" },
    { value: "internet", label: "Internet", group: "Moradia", emoji: "🌐", type: "expense" },
    { value: "tv_assinatura", label: "TV por Assinatura", group: "Moradia", emoji: "📺", type: "expense" },
    { value: "manutencao_casa", label: "Manutenção da Casa", group: "Moradia", emoji: "🔧", type: "expense" },
    { value: "seguro_residencial", label: "Seguro Residencial", group: "Moradia", emoji: "🛡️", type: "expense" },

    // 🚗 Transporte
    { value: "combustivel", label: "Combustível", group: "Transporte", emoji: "⛽", type: "expense" },
    { value: "estacionamento", label: "Estacionamento", group: "Transporte", emoji: "🅿️", type: "expense" },
    { value: "pedagio", label: "Pedágio", group: "Transporte", emoji: "🛣️", type: "expense" },
    { value: "uber_99_taxi", label: "Uber / 99 / Táxi", group: "Transporte", emoji: "🚕", type: "expense" },
    { value: "transporte_publico", label: "Ônibus / Metrô", group: "Transporte", emoji: "🚌", type: "expense" },
    { value: "seguro_veiculo", label: "Seguro do Veículo", group: "Transporte", emoji: "🚗", type: "expense" },
    { value: "ipva", label: "IPVA", group: "Transporte", emoji: "📄", type: "expense" },
    { value: "manutencao_veiculo", label: "Manutenção do Veículo", group: "Transporte", emoji: "🔩", type: "expense" },

    // 👕 Vestuário
    { value: "roupas", label: "Roupas", group: "Vestuário", emoji: "👕", type: "expense" },
    { value: "calcados", label: "Calçados", group: "Vestuário", emoji: "👟", type: "expense" },
    { value: "acessorios_vestuario", label: "Acessórios", group: "Vestuário", emoji: "👜", type: "expense" },

    // 💊 Saúde
    { value: "plano_saude", label: "Plano de Saúde", group: "Saúde", emoji: "🏥", type: "expense" },
    { value: "farmacia", label: "Farmácia / Medicamentos", group: "Saúde", emoji: "💊", type: "expense" },
    { value: "consulta_medica", label: "Consulta Médica", group: "Saúde", emoji: "🩺", type: "expense" },
    { value: "dentista", label: "Dentista", group: "Saúde", emoji: "🦷", type: "expense" },
    { value: "exames_laboratorio", label: "Exames / Laboratório", group: "Saúde", emoji: "🔬", type: "expense" },
    { value: "terapia_psicologo", label: "Terapia / Psicólogo", group: "Saúde", emoji: "🧠", type: "expense" },
    { value: "academia_esporte", label: "Academia / Esporte", group: "Saúde", emoji: "💪", type: "expense" },

    // 📚 Educação
    { value: "escola_faculdade", label: "Escola / Faculdade", group: "Educação", emoji: "🎓", type: "expense" },
    { value: "curso_online", label: "Curso Online", group: "Educação", emoji: "💻", type: "expense" },
    { value: "material_escolar", label: "Material Escolar", group: "Educação", emoji: "📝", type: "expense" },
    { value: "livros", label: "Livros", group: "Educação", emoji: "📚", type: "expense" },
    { value: "idiomas", label: "Idiomas", group: "Educação", emoji: "🗣️", type: "expense" },
    { value: "treinamentos", label: "Treinamentos", group: "Educação", emoji: "📖", type: "expense" },

    // 🎮 Lazer e Entretenimento
    { value: "cinema_teatro", label: "Cinema / Teatro", group: "Lazer", emoji: "🎬", type: "expense" },
    { value: "streaming", label: "Streaming (Netflix, etc.)", group: "Lazer", emoji: "📱", type: "expense" },
    { value: "jogos_games", label: "Jogos / Games", group: "Lazer", emoji: "🎮", type: "expense" },
    { value: "viagens", label: "Viagens", group: "Lazer", emoji: "✈️", type: "expense" },
    { value: "hospedagem", label: "Hospedagem", group: "Lazer", emoji: "🏨", type: "expense" },
    { value: "passeios_parques", label: "Passeios / Parques", group: "Lazer", emoji: "🎡", type: "expense" },
    { value: "shows_eventos", label: "Shows / Eventos", group: "Lazer", emoji: "🎤", type: "expense" },
    { value: "hobbies", label: "Hobbies", group: "Lazer", emoji: "🎨", type: "expense" },

    // 👶 Filhos / Família
    { value: "escola_filhos", label: "Escola dos Filhos", group: "Família", emoji: "🏫", type: "expense" },
    { value: "material_filhos", label: "Material dos Filhos", group: "Família", emoji: "✏️", type: "expense" },
    { value: "brinquedos", label: "Brinquedos", group: "Família", emoji: "🧸", type: "expense" },
    { value: "baba_creche", label: "Babá / Creche", group: "Família", emoji: "👶", type: "expense" },
    { value: "mesada", label: "Mesada", group: "Família", emoji: "🪙", type: "expense" },

    // 🐾 Pets
    { value: "racao_petshop", label: "Ração / Pet Shop", group: "Pets", emoji: "🐕", type: "expense" },
    { value: "veterinario", label: "Veterinário", group: "Pets", emoji: "🐾", type: "expense" },
    { value: "banho_tosa", label: "Banho e Tosa", group: "Pets", emoji: "🚿", type: "expense" },
    { value: "acessorios_pet", label: "Acessórios Pet", group: "Pets", emoji: "🦴", type: "expense" },

    // 💼 Trabalho
    { value: "material_escritorio", label: "Material de Escritório", group: "Trabalho", emoji: "🖊️", type: "expense" },
    { value: "coworking", label: "Coworking", group: "Trabalho", emoji: "🏢", type: "expense" },
    { value: "ferramentas_profissionais", label: "Ferramentas Profissionais", group: "Trabalho", emoji: "🛠️", type: "expense" },
    { value: "uniforme_profissional", label: "Uniforme / Vestimenta Profissional", group: "Trabalho", emoji: "👔", type: "expense" },

    // 📱 Tecnologia
    { value: "celular_telefone", label: "Celular / Telefone", group: "Tecnologia", emoji: "📱", type: "expense" },
    { value: "assinaturas_digitais", label: "Assinaturas Digitais", group: "Tecnologia", emoji: "🔑", type: "expense" },
    { value: "software_apps", label: "Software / Apps", group: "Tecnologia", emoji: "💿", type: "expense" },
    { value: "equipamentos_tech", label: "Equipamentos", group: "Tecnologia", emoji: "🖥️", type: "expense" },
    { value: "manutencao_eletronicos", label: "Manutenção de Eletrônicos", group: "Tecnologia", emoji: "🔌", type: "expense" },

    // 🏦 Financeiro
    { value: "tarifa_bancaria", label: "Tarifa Bancária", group: "Financeiro", emoji: "🏦", type: "expense" },
    { value: "pagamento_fatura", label: "Pagamento de Fatura", group: "Financeiro", emoji: "💳", type: "expense" },
    { value: "anuidade_cartao", label: "Anuidade de Cartão", group: "Financeiro", emoji: "💳", type: "expense" },
    { value: "emprestimo", label: "Empréstimo", group: "Financeiro", emoji: "📊", type: "expense" },
    { value: "financiamento", label: "Financiamento", group: "Financeiro", emoji: "🏡", type: "expense" },
    { value: "consorcio", label: "Consórcio", group: "Financeiro", emoji: "🤝", type: "expense" },
    { value: "investimentos", label: "Investimentos", group: "Financeiro", emoji: "📈", type: "expense" },
    { value: "previdencia_privada", label: "Previdência Privada", group: "Financeiro", emoji: "🧓", type: "expense" },
    { value: "seguros_vida", label: "Seguros (Vida, etc.)", group: "Financeiro", emoji: "🛡️", type: "expense" },

    // 🎁 Compras Pessoais
    { value: "presentes", label: "Presentes", group: "Compras Pessoais", emoji: "🎁", type: "expense" },
    { value: "cosmeticos_beleza", label: "Cosméticos / Beleza", group: "Compras Pessoais", emoji: "💄", type: "expense" },
    { value: "salao_barbearia", label: "Salão / Barbearia", group: "Compras Pessoais", emoji: "💇", type: "expense" },
    { value: "perfumaria", label: "Perfumaria", group: "Compras Pessoais", emoji: "🧴", type: "expense" },
    { value: "eletronicos_pessoais", label: "Eletrônicos", group: "Compras Pessoais", emoji: "📦", type: "expense" },
    { value: "decoracao", label: "Decoração", group: "Compras Pessoais", emoji: "🖼️", type: "expense" },

    // 🏛️ Impostos e Taxas
    { value: "imposto_renda", label: "Imposto de Renda", group: "Impostos", emoji: "🦁", type: "expense" },
    { value: "inss", label: "INSS", group: "Impostos", emoji: "📑", type: "expense" },
    { value: "taxas_governamentais", label: "Taxas Governamentais", group: "Impostos", emoji: "🏛️", type: "expense" },
    { value: "multas", label: "Multas", group: "Impostos", emoji: "⚠️", type: "expense" },
    { value: "cartorio_documentos", label: "Cartório / Documentos", group: "Impostos", emoji: "📜", type: "expense" },

    // 💝 Doações e Contribuições
    { value: "doacoes", label: "Doações", group: "Doações", emoji: "💝", type: "expense" },
    { value: "dizimo_oferta", label: "Dízimo / Oferta", group: "Doações", emoji: "⛪", type: "expense" },
    { value: "contribuicao_sindical", label: "Contribuição Sindical", group: "Impostos", emoji: "🏷️", type: "expense" },

    // 📦 Assinaturas e Mensalidades
    { value: "musica_streaming", label: "Spotify / Música", group: "Assinaturas", emoji: "🎵", type: "expense" },
    { value: "clube_assinatura", label: "Clube de Assinatura", group: "Assinaturas", emoji: "📬", type: "expense" },
    { value: "jornal_revista", label: "Jornal / Revista", group: "Assinaturas", emoji: "📰", type: "expense" },
    { value: "armazenamento_nuvem", label: "Armazenamento em Nuvem", group: "Assinaturas", emoji: "☁️", type: "expense" },
    { value: "vpn_seguranca", label: "VPN / Segurança Digital", group: "Assinaturas", emoji: "🔒", type: "expense" },

    // 🔧 Outros
    { value: "emergencia_medica", label: "Despesas Médicas Emergenciais", group: "Outros", emoji: "🚑", type: "expense" },
    { value: "mudanca", label: "Mudança", group: "Outros", emoji: "📦", type: "expense" },
    { value: "frete_correios", label: "Frete / Correios", group: "Outros", emoji: "📮", type: "expense" },
    { value: "servicos_gerais", label: "Serviços (Encanador, Eletricista)", group: "Outros", emoji: "🔧", type: "expense" },
    { value: "outros", label: "Outros", group: "Outros", emoji: "📌", type: "expense" },

    // 💰 Receitas
    { value: "salario", label: "Salário", group: "Receitas", emoji: "💰", type: "income" },
    { value: "freelance", label: "Freelance / Autônomo", group: "Receitas", emoji: "💻", type: "income" },
    { value: "vendas", label: "Vendas", group: "Receitas", emoji: "🏪", type: "income" },
    { value: "aluguel_recebido", label: "Aluguel Recebido", group: "Receitas", emoji: "🏠", type: "income" },
    { value: "investimentos_rendimento", label: "Rendimento de Investimentos", group: "Receitas", emoji: "📈", type: "income" },
    { value: "bonus", label: "Bônus / 13° Salário", group: "Receitas", emoji: "🎉", type: "income" },
    { value: "pensao_recebida", label: "Pensão Recebida", group: "Receitas", emoji: "💵", type: "income" },
    { value: "comissao", label: "Comissão", group: "Receitas", emoji: "🤑", type: "income" },
    { value: "reembolso", label: "Reembolso", group: "Receitas", emoji: "🔄", type: "income" },
    { value: "presente_recebido", label: "Presente / Doação Recebida", group: "Receitas", emoji: "🎁", type: "income" },
    { value: "servico_prestado", label: "Serviço Prestado", group: "Receitas", emoji: "🛠️", type: "income" },
    { value: "outros_receita", label: "Outras Receitas", group: "Receitas", emoji: "💲", type: "income" },

    // 🔁 Transferência (ambos)
    { value: "transferencia", label: "Transferência entre Contas", group: "Transferência", emoji: "🔁", type: "both" },
];

// Helper: get all unique groups ordered
export const CATEGORY_GROUPS = [...new Set(FIXED_CATEGORIES.map(c => c.group))];

// Helper: get groups filtered by type
export const getCategoryGroupsByType = (type: 'income' | 'expense'): string[] => {
    const filtered = FIXED_CATEGORIES.filter(c => c.type === type || c.type === 'both');
    return [...new Set(filtered.map(c => c.group))];
};

// Helper: get categories filtered by type
export const getCategoriesByType = (type: 'income' | 'expense'): CategoryItem[] => {
    return FIXED_CATEGORIES.filter(c => c.type === type || c.type === 'both');
};

// Helper: get display label for a category value
export function getCategoryLabel(value: string): string {
    const found = FIXED_CATEGORIES.find(c => c.value === value);
    if (found) return `${found.emoji} ${found.label}`;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

// ============================================
// 20 Bancos Brasileiros Pré-cadastrados
// ============================================

export interface BankPreset {
    name: string;
    color: string;
    initials: string;
}

export const BANK_PRESETS: BankPreset[] = [
    { name: "Nubank", color: "#8B5CF6", initials: "NU" },
    { name: "Itaú", color: "#F97316", initials: "IT" },
    { name: "Bradesco", color: "#DC2626", initials: "BR" },
    { name: "Banco do Brasil", color: "#F59E0B", initials: "BB" },
    { name: "Caixa Econômica", color: "#2563EB", initials: "CX" },
    { name: "Santander", color: "#EF4444", initials: "SA" },
    { name: "Inter", color: "#EA580C", initials: "IN" },
    { name: "C6 Bank", color: "#1E293B", initials: "C6" },
    { name: "PicPay", color: "#10B981", initials: "PP" },
    { name: "Mercado Pago", color: "#2563EB", initials: "MP" },
    { name: "BTG Pactual", color: "#1E3A5F", initials: "BT" },
    { name: "Neon", color: "#06B6D4", initials: "NE" },
    { name: "PagBank (PagSeguro)", color: "#16A34A", initials: "PB" },
    { name: "Next", color: "#22C55E", initials: "NX" },
    { name: "Sicoob", color: "#15803D", initials: "SC" },
    { name: "Sicredi", color: "#16A34A", initials: "SI" },
    { name: "Banco Original", color: "#22C55E", initials: "OR" },
    { name: "Banrisul", color: "#2563EB", initials: "BA" },
    { name: "Safra", color: "#1E3A5F", initials: "SF" },
];
