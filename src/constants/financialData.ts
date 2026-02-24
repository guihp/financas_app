// ============================================
// 100 Categorias Fixas de Gastos Brasileiros
// ============================================

export interface CategoryItem {
    value: string;
    label: string;
    group: string;
    emoji: string;
}

export const FIXED_CATEGORIES: CategoryItem[] = [
    // 🍽️ Alimentação
    { value: "supermercado", label: "Supermercado", group: "Alimentação", emoji: "🛒" },
    { value: "restaurante", label: "Restaurante", group: "Alimentação", emoji: "🍽️" },
    { value: "lanchonete", label: "Lanchonete / Fast Food", group: "Alimentação", emoji: "🍔" },
    { value: "padaria", label: "Padaria", group: "Alimentação", emoji: "🥐" },
    { value: "delivery", label: "Delivery / iFood", group: "Alimentação", emoji: "📦" },
    { value: "acougue", label: "Açougue", group: "Alimentação", emoji: "🥩" },
    { value: "feira", label: "Feira / Hortifruti", group: "Alimentação", emoji: "🥬" },
    { value: "bebidas", label: "Bebidas", group: "Alimentação", emoji: "🥤" },

    // 🏠 Moradia
    { value: "aluguel", label: "Aluguel", group: "Moradia", emoji: "🏠" },
    { value: "condominio", label: "Condomínio", group: "Moradia", emoji: "🏢" },
    { value: "iptu", label: "IPTU", group: "Moradia", emoji: "📋" },
    { value: "energia_eletrica", label: "Energia Elétrica", group: "Moradia", emoji: "⚡" },
    { value: "agua_esgoto", label: "Água e Esgoto", group: "Moradia", emoji: "💧" },
    { value: "gas", label: "Gás", group: "Moradia", emoji: "🔥" },
    { value: "internet", label: "Internet", group: "Moradia", emoji: "🌐" },
    { value: "tv_assinatura", label: "TV por Assinatura", group: "Moradia", emoji: "📺" },
    { value: "manutencao_casa", label: "Manutenção da Casa", group: "Moradia", emoji: "🔧" },
    { value: "seguro_residencial", label: "Seguro Residencial", group: "Moradia", emoji: "🛡️" },

    // 🚗 Transporte
    { value: "combustivel", label: "Combustível", group: "Transporte", emoji: "⛽" },
    { value: "estacionamento", label: "Estacionamento", group: "Transporte", emoji: "🅿️" },
    { value: "pedagio", label: "Pedágio", group: "Transporte", emoji: "🛣️" },
    { value: "uber_99_taxi", label: "Uber / 99 / Táxi", group: "Transporte", emoji: "🚕" },
    { value: "transporte_publico", label: "Ônibus / Metrô", group: "Transporte", emoji: "🚌" },
    { value: "seguro_veiculo", label: "Seguro do Veículo", group: "Transporte", emoji: "🚗" },
    { value: "ipva", label: "IPVA", group: "Transporte", emoji: "📄" },
    { value: "manutencao_veiculo", label: "Manutenção do Veículo", group: "Transporte", emoji: "🔩" },

    // 👕 Vestuário
    { value: "roupas", label: "Roupas", group: "Vestuário", emoji: "👕" },
    { value: "calcados", label: "Calçados", group: "Vestuário", emoji: "👟" },
    { value: "acessorios_vestuario", label: "Acessórios", group: "Vestuário", emoji: "👜" },

    // 💊 Saúde
    { value: "plano_saude", label: "Plano de Saúde", group: "Saúde", emoji: "🏥" },
    { value: "farmacia", label: "Farmácia / Medicamentos", group: "Saúde", emoji: "💊" },
    { value: "consulta_medica", label: "Consulta Médica", group: "Saúde", emoji: "🩺" },
    { value: "dentista", label: "Dentista", group: "Saúde", emoji: "🦷" },
    { value: "exames_laboratorio", label: "Exames / Laboratório", group: "Saúde", emoji: "🔬" },
    { value: "terapia_psicologo", label: "Terapia / Psicólogo", group: "Saúde", emoji: "🧠" },
    { value: "academia_esporte", label: "Academia / Esporte", group: "Saúde", emoji: "💪" },

    // 📚 Educação
    { value: "escola_faculdade", label: "Escola / Faculdade", group: "Educação", emoji: "🎓" },
    { value: "curso_online", label: "Curso Online", group: "Educação", emoji: "💻" },
    { value: "material_escolar", label: "Material Escolar", group: "Educação", emoji: "📝" },
    { value: "livros", label: "Livros", group: "Educação", emoji: "📚" },
    { value: "idiomas", label: "Idiomas", group: "Educação", emoji: "🗣️" },
    { value: "treinamentos", label: "Treinamentos", group: "Educação", emoji: "📖" },

    // 🎮 Lazer e Entretenimento
    { value: "cinema_teatro", label: "Cinema / Teatro", group: "Lazer", emoji: "🎬" },
    { value: "streaming", label: "Streaming (Netflix, etc.)", group: "Lazer", emoji: "📱" },
    { value: "jogos_games", label: "Jogos / Games", group: "Lazer", emoji: "🎮" },
    { value: "viagens", label: "Viagens", group: "Lazer", emoji: "✈️" },
    { value: "hospedagem", label: "Hospedagem", group: "Lazer", emoji: "🏨" },
    { value: "passeios_parques", label: "Passeios / Parques", group: "Lazer", emoji: "🎡" },
    { value: "shows_eventos", label: "Shows / Eventos", group: "Lazer", emoji: "🎤" },
    { value: "hobbies", label: "Hobbies", group: "Lazer", emoji: "🎨" },

    // 👶 Filhos / Família
    { value: "escola_filhos", label: "Escola dos Filhos", group: "Família", emoji: "🏫" },
    { value: "material_filhos", label: "Material dos Filhos", group: "Família", emoji: "✏️" },
    { value: "brinquedos", label: "Brinquedos", group: "Família", emoji: "🧸" },
    { value: "baba_creche", label: "Babá / Creche", group: "Família", emoji: "👶" },
    { value: "mesada", label: "Mesada", group: "Família", emoji: "🪙" },

    // 🐾 Pets
    { value: "racao_petshop", label: "Ração / Pet Shop", group: "Pets", emoji: "🐕" },
    { value: "veterinario", label: "Veterinário", group: "Pets", emoji: "🐾" },
    { value: "banho_tosa", label: "Banho e Tosa", group: "Pets", emoji: "🚿" },
    { value: "acessorios_pet", label: "Acessórios Pet", group: "Pets", emoji: "🦴" },

    // 💼 Trabalho
    { value: "material_escritorio", label: "Material de Escritório", group: "Trabalho", emoji: "🖊️" },
    { value: "coworking", label: "Coworking", group: "Trabalho", emoji: "🏢" },
    { value: "ferramentas_profissionais", label: "Ferramentas Profissionais", group: "Trabalho", emoji: "🛠️" },
    { value: "uniforme_profissional", label: "Uniforme / Vestimenta Profissional", group: "Trabalho", emoji: "👔" },

    // 📱 Tecnologia
    { value: "celular_telefone", label: "Celular / Telefone", group: "Tecnologia", emoji: "📱" },
    { value: "assinaturas_digitais", label: "Assinaturas Digitais", group: "Tecnologia", emoji: "🔑" },
    { value: "software_apps", label: "Software / Apps", group: "Tecnologia", emoji: "💿" },
    { value: "equipamentos_tech", label: "Equipamentos", group: "Tecnologia", emoji: "🖥️" },
    { value: "manutencao_eletronicos", label: "Manutenção de Eletrônicos", group: "Tecnologia", emoji: "🔌" },

    // 🏦 Financeiro
    { value: "tarifa_bancaria", label: "Tarifa Bancária", group: "Financeiro", emoji: "🏦" },
    { value: "anuidade_cartao", label: "Anuidade de Cartão", group: "Financeiro", emoji: "💳" },
    { value: "emprestimo", label: "Empréstimo", group: "Financeiro", emoji: "📊" },
    { value: "financiamento", label: "Financiamento", group: "Financeiro", emoji: "🏡" },
    { value: "consorcio", label: "Consórcio", group: "Financeiro", emoji: "🤝" },
    { value: "investimentos", label: "Investimentos", group: "Financeiro", emoji: "📈" },
    { value: "previdencia_privada", label: "Previdência Privada", group: "Financeiro", emoji: "🧓" },
    { value: "seguros_vida", label: "Seguros (Vida, etc.)", group: "Financeiro", emoji: "🛡️" },

    // 🎁 Compras Pessoais
    { value: "presentes", label: "Presentes", group: "Compras Pessoais", emoji: "🎁" },
    { value: "cosmeticos_beleza", label: "Cosméticos / Beleza", group: "Compras Pessoais", emoji: "💄" },
    { value: "salao_barbearia", label: "Salão / Barbearia", group: "Compras Pessoais", emoji: "💇" },
    { value: "perfumaria", label: "Perfumaria", group: "Compras Pessoais", emoji: "🧴" },
    { value: "eletronicos_pessoais", label: "Eletrônicos", group: "Compras Pessoais", emoji: "📦" },
    { value: "decoracao", label: "Decoração", group: "Compras Pessoais", emoji: "🖼️" },

    // 🏛️ Impostos e Taxas
    { value: "imposto_renda", label: "Imposto de Renda", group: "Impostos", emoji: "🦁" },
    { value: "inss", label: "INSS", group: "Impostos", emoji: "📑" },
    { value: "taxas_governamentais", label: "Taxas Governamentais", group: "Impostos", emoji: "🏛️" },
    { value: "multas", label: "Multas", group: "Impostos", emoji: "⚠️" },
    { value: "cartorio_documentos", label: "Cartório / Documentos", group: "Impostos", emoji: "📜" },

    // 💝 Doações e Contribuições
    { value: "doacoes", label: "Doações", group: "Doações", emoji: "💝" },
    { value: "dizimo_oferta", label: "Dízimo / Oferta", group: "Doações", emoji: "⛪" },
    { value: "contribuicao_sindical", label: "Contribuição Sindical", group: "Doações", emoji: "🏷️" },

    // 📦 Assinaturas e Mensalidades
    { value: "musica_streaming", label: "Spotify / Música", group: "Assinaturas", emoji: "🎵" },
    { value: "clube_assinatura", label: "Clube de Assinatura", group: "Assinaturas", emoji: "📬" },
    { value: "jornal_revista", label: "Jornal / Revista", group: "Assinaturas", emoji: "📰" },
    { value: "armazenamento_nuvem", label: "Armazenamento em Nuvem", group: "Assinaturas", emoji: "☁️" },
    { value: "vpn_seguranca", label: "VPN / Segurança Digital", group: "Assinaturas", emoji: "🔒" },

    // 🔧 Outros
    { value: "emergencia_medica", label: "Despesas Médicas Emergenciais", group: "Outros", emoji: "🚑" },
    { value: "mudanca", label: "Mudança", group: "Outros", emoji: "📦" },
    { value: "frete_correios", label: "Frete / Correios", group: "Outros", emoji: "📮" },
    { value: "servicos_gerais", label: "Serviços (Encanador, Eletricista)", group: "Outros", emoji: "🔧" },
    { value: "outros", label: "Outros", group: "Outros", emoji: "📌" },
];

// Helper: get all unique groups ordered
export const CATEGORY_GROUPS = [...new Set(FIXED_CATEGORIES.map(c => c.group))];

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
    { name: "Will Bank", color: "#FACC15", initials: "WB" },
];
