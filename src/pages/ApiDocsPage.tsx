import { ApiTestForm } from "@/components/ApiTestForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, Copy, Check, ChevronDown, ChevronUp, AlertTriangle, Info, Zap, BookOpen, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface Param {
    name: string;
    type: string;
    required: boolean;
    description: string;
    values?: string[];
}

interface ErrorInfo {
    code: number;
    message: string;
    cause: string;
    fix: string;
}

interface Endpoint {
    method: string;
    path: string;
    summary: string;
    description: string;
    params: Param[];
    curlCommand: string;
    responseExample: string;
    errors: ErrorInfo[];
    tips?: string;
}

/* ─────────────────────────────────────────────
   Reusable Components
───────────────────────────────────────────── */
const ParamRow = ({ p }: { p: Param }) => (
    <tr className="border-b border-slate-800/50 last:border-0">
        <td className="py-2 px-3 font-mono text-xs text-blue-300 whitespace-nowrap">{p.name}</td>
        <td className="py-2 px-3 text-xs text-slate-400 whitespace-nowrap">{p.type}</td>
        <td className="py-2 px-3 text-center">
            {p.required
                ? <Badge className="bg-red-600/20 text-red-400 border border-red-800 text-[10px]">Obrigatório</Badge>
                : <Badge className="bg-slate-700/40 text-slate-400 border border-slate-700 text-[10px]">Opcional</Badge>}
        </td>
        <td className="py-2 px-3 text-xs text-slate-300">
            {p.description}
            {p.values && (
                <span className="block mt-1 text-[11px] text-slate-500">
                    Valores: {p.values.map((v, i) => <code key={i} className="mx-0.5 text-green-400 bg-slate-800 px-1 py-0.5 rounded">{v}</code>)}
                </span>
            )}
        </td>
    </tr>
);

const EndpointCard = ({ ep }: { ep: Endpoint }) => {
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(ep.curlCommand);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const methodColors: Record<string, string> = {
        GET: "bg-blue-600 hover:bg-blue-700",
        POST: "bg-green-600 hover:bg-green-700",
        PUT: "bg-orange-600 hover:bg-orange-700",
        DELETE: "bg-red-600 hover:bg-red-700"
    };

    return (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-sm">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 bg-slate-800/30 border-b border-slate-800/50 flex items-center gap-3 text-left hover:bg-slate-800/50 transition-colors"
            >
                <Badge className={`${methodColors[ep.method] || "bg-gray-600"} text-white font-mono text-xs shrink-0`}>{ep.method}</Badge>
                <code className="text-slate-200 font-semibold font-mono text-sm truncate">{ep.path}</code>
                <span className="ml-auto text-slate-400 shrink-0">
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
            </button>

            {/* Summary (always visible) */}
            <div className="px-4 pt-3 pb-2">
                <p className="text-sm text-slate-300 leading-relaxed">{ep.summary}</p>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <CardContent className="px-4 pb-4 space-y-4">
                    {/* Full description */}
                    <div className="bg-slate-950/60 rounded-md p-3 border border-slate-800/50">
                        <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{ep.description}</p>
                    </div>

                    {/* Parameter Table */}
                    {ep.params.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <BookOpen className="h-3 w-3" /> Parâmetros
                            </h4>
                            <div className="overflow-x-auto rounded-md border border-slate-800">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-800/50">
                                        <tr>
                                            <th className="py-2 px-3 text-[11px] text-slate-400 font-medium uppercase">Campo</th>
                                            <th className="py-2 px-3 text-[11px] text-slate-400 font-medium uppercase">Tipo</th>
                                            <th className="py-2 px-3 text-[11px] text-slate-400 font-medium uppercase text-center">Status</th>
                                            <th className="py-2 px-3 text-[11px] text-slate-400 font-medium uppercase">Descrição</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ep.params.map((p, i) => <ParamRow key={i} p={p} />)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tips */}
                    {ep.tips && (
                        <div className="flex gap-2 items-start bg-blue-950/30 border border-blue-900/30 rounded-md p-3">
                            <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-300 leading-relaxed">{ep.tips}</p>
                        </div>
                    )}

                    {/* cURL */}
                    <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Zap className="h-3 w-3" /> Exemplo cURL
                        </h4>
                        <div className="relative group rounded-md overflow-hidden bg-slate-950 border border-slate-800/50">
                            <pre className="p-4 text-xs font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap break-all">
                                {ep.curlCommand}
                            </pre>
                            <Button
                                size="icon" variant="ghost"
                                className="absolute top-2 right-2 h-8 w-8 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 hover:bg-slate-800 hover:text-foreground"
                                onClick={handleCopy}
                            >
                                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    {/* Response Example */}
                    <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">✅ Resposta de Sucesso</h4>
                        <pre className="bg-slate-950 border border-slate-800/50 rounded-md p-4 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
                            {ep.responseExample}
                        </pre>
                    </div>

                    {/* Error Troubleshooting */}
                    {ep.errors.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <AlertTriangle className="h-3 w-3 text-yellow-400" /> Erros Comuns e Como Resolver
                            </h4>
                            <div className="space-y-2">
                                {ep.errors.map((err, i) => (
                                    <div key={i} className="bg-red-950/20 border border-red-900/30 rounded-md p-3 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-red-900/50 text-red-300 border border-red-800 text-[10px] font-mono">{err.code}</Badge>
                                            <span className="text-xs text-red-300 font-semibold">{err.message}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400"><strong className="text-slate-300">Causa:</strong> {err.cause}</p>
                                        <p className="text-[11px] text-green-400"><strong className="text-green-300">✔ Solução:</strong> {err.fix}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
};

/* ─────────────────────────────────────────────
   BASE URL
───────────────────────────────────────────── */
const BASE = "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1";


/* ─────────────────────────────────────────────
   ENDPOINTS DATA
───────────────────────────────────────────── */
const endpoints: Endpoint[] = [
    // ── 1. GET USER ──────────────────────────
    {
        method: "GET",
        path: "/get-user-by-phone",
        summary: "Busca o perfil completo do usuário usando o número de telefone. Este deve ser SEMPRE o primeiro passo.",
        description: `Retorna o perfil do usuário, status da assinatura, bancos e cartões de crédito cadastrados.
Use esta API no início de todo fluxo para obter o user_id (UUID) que será necessário nas demais chamadas.

O telefone pode ser enviado em qualquer formato (com ou sem +55, com ou sem DDD). O sistema normaliza automaticamente.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Número de telefone do usuário (query param). Ex: 5511999999999" },
        ],
        curlCommand: `curl -X GET "${BASE}/get-user-by-phone?phone=5511999999999" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"`,
        responseExample: `{
  "user_id": "a1b2c3d4-e5f6-...",
  "full_name": "João Silva",
  "email": "joao@email.com",
  "phone": "5511999999999",
  "subscription_status": "active",
  "bank_accounts": [...],
  "credit_cards": [...]
}`,
        errors: [
            { code: 404, message: "Usuário não encontrado", cause: "O telefone informado não está cadastrado no sistema.", fix: "Verifique se o número está correto com DDD. Tente com formato 5511999999999 (sem + e sem espaços)." },
            { code: 401, message: "Unauthorized", cause: "O header Authorization está faltando ou o token está inválido.", fix: "Adicione o header: Authorization: Bearer <sua_SUPABASE_ANON_KEY>. Pegue a chave no dashboard do Supabase > Settings > API." },
        ],
        tips: "💡 O user_id retornado pode ser usado em todas as outras APIs como alternativa ao phone. Isso é mais rápido e confiável.",
    },

    // ── 2. GET CATEGORIES (global) ──────────
    {
        method: "GET",
        path: "/get-categories",
        summary: "Lista a árvore de categorias padrão do sistema (Receitas e Despesas).",
        description: `Retorna as categorias fixas da plataforma em formato de árvore, divididas por tipo (income/expense).

⚠️ Esta API retorna as categorias PADRÃO do sistema, não as personalizadas do usuário.
Para listar as categorias personalizadas de um usuário específico, use /manage-categories com action=list_categories.`,
        params: [],
        curlCommand: `curl -X GET "${BASE}/get-categories" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"`,
        responseExample: `{
  "income": [
    { "name": "Salário", "slug": "salario" },
    { "name": "Freelancer", "slug": "freelancer" }
  ],
  "expense": [
    { "name": "Alimentação", "slug": "alimentacao" },
    { "name": "Transporte", "slug": "transporte" }
  ]
}`,
        errors: [
            { code: 401, message: "Unauthorized", cause: "Header Authorization ausente.", fix: "Adicione o header Authorization com a chave anon do Supabase." },
        ],
        tips: "💡 Use esta API para guiar a IA sobre quais categorias existem. Para categorias do usuário, use /manage-categories com action=list_categories.",
    },

    // ── 3. MANAGE CATEGORIES: Listar ────────
    {
        method: "POST",
        path: "/manage-categories (Listar Categorias)",
        summary: "Lista todas as categorias personalizadas de um usuário específico.",
        description: `Retorna todas as categorias que o usuário criou. Use user_id OU phone.
Opcionalmente filtre por type=income ou type=expense.

IDENTIFICAÇÃO: Envie user_id (obtido via /get-user-by-phone) OU phone. Pelo menos um é obrigatório.`,
        params: [
            { name: "user_id", type: "uuid", required: false, description: "UUID do usuário. Alternativa ao phone." },
            { name: "phone", type: "string", required: false, description: "Telefone do usuário. Alternativa ao user_id." },
            { name: "action", type: "string", required: true, description: "Deve ser 'list_categories'.", values: ["list_categories"] },
            { name: "type", type: "string", required: false, description: "Filtro por tipo.", values: ["income", "expense"] },
        ],
        curlCommand: `curl -X POST "${BASE}/manage-categories" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "uuid-do-usuario",
    "action": "list_categories",
    "type": "expense"
  }'`,
        responseExample: `{ "success": true, "data": [{ "id": "uuid", "name": "Alimentação", "type": "expense" }, ...] }`,
        errors: [
            { code: 404, message: "Usuário não encontrado", cause: "Nem user_id nem phone enviados.", fix: "Envie user_id (obtido via /get-user-by-phone) OU phone." },
        ],
        tips: "💡 Sempre liste as categorias antes de criar/editar para evitar duplicatas e erros 404.",
    },

    // ── 4. MANAGE CATEGORIES: Criar ─────────
    {
        method: "POST",
        path: "/manage-categories (Criar Categoria)",
        summary: "Cria uma nova categoria principal para o usuário (income ou expense).",
        description: `Cria uma nova categoria personalizada. O nome é verificado por duplicidade (case-insensitive).

IDENTIFICAÇÃO: Envie user_id OU phone.
TIPO: O campo type é opcional (padrão: expense).`,
        params: [
            { name: "user_id", type: "uuid", required: false, description: "UUID do usuário." },
            { name: "phone", type: "string", required: false, description: "Telefone do usuário." },
            { name: "action", type: "string", required: true, description: "Deve ser 'create_category'.", values: ["create_category"] },
            { name: "name", type: "string", required: true, description: "Nome da nova categoria. Ex: Academia, Lazer." },
            { name: "type", type: "string", required: false, description: "Tipo. Padrão: expense.", values: ["income", "expense"] },
        ],
        curlCommand: `curl -X POST "${BASE}/manage-categories" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "uuid-do-usuario",
    "action": "create_category",
    "name": "Academia",
    "type": "expense"
  }'`,
        responseExample: `{ "success": true, "data": { "id": "uuid-nova", "name": "Academia", "type": "expense" } }`,
        errors: [
            { code: 400, message: "Categoria já existe", cause: "Uma categoria com esse nome já existe.", fix: "Escolha outro nome ou edite a existente com edit_category." },
            { code: 404, message: "Usuário não encontrado", cause: "user_id/phone incorreto.", fix: "Confirme com /get-user-by-phone." },
        ],
    },

    // ── 5. MANAGE CATEGORIES: Subcategoria ──
    {
        method: "POST",
        path: "/manage-categories (Criar Subcategoria)",
        summary: "Cria uma subcategoria vinculada a uma categoria pai existente do usuário.",
        description: `Cria uma subcategoria dentro de uma categoria pai. A busca do pai é feita pelo nome exato (case-insensitive).

IMPORTANTE: O parent_name deve existir nas categorias do usuário. Use list_categories primeiro.`,
        params: [
            { name: "user_id", type: "uuid", required: false, description: "UUID do usuário." },
            { name: "phone", type: "string", required: false, description: "Telefone do usuário." },
            { name: "action", type: "string", required: true, description: "Deve ser 'create_subcategory'.", values: ["create_subcategory"] },
            { name: "name", type: "string", required: true, description: "Nome da subcategoria. Ex: Mensalidade." },
            { name: "parent_name", type: "string", required: true, description: "Nome exato da categoria pai. Ex: Academia." },
            { name: "type", type: "string", required: false, description: "Tipo. Padrão: expense.", values: ["income", "expense"] },
        ],
        curlCommand: `curl -X POST "${BASE}/manage-categories" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "uuid-do-usuario",
    "action": "create_subcategory",
    "name": "Mensalidade",
    "parent_name": "Academia",
    "type": "expense"
  }'`,
        responseExample: `{ "success": true, "data": { "id": "uuid", "name": "Mensalidade", "parent_id": "uuid-pai" } }`,
        errors: [
            { code: 404, message: "Categoria Pai não encontrada", cause: "O parent_name não existe nas categorias do usuário.", fix: "Use list_categories para ver as categorias disponíveis." },
        ],
    },

    // ── 6. MANAGE CATEGORIES: Editar ────────
    {
        method: "POST",
        path: "/manage-categories (Editar Categoria)",
        summary: "Renomeia uma categoria existente. Busca por nome exato (case-insensitive).",
        description: `Permite alterar o nome de uma categoria e opcionalmente mover para dentro de outra (parent_name).

A busca é feita pelo old_name exato (case-insensitive).`,
        params: [
            { name: "user_id", type: "uuid", required: false, description: "UUID do usuário." },
            { name: "phone", type: "string", required: false, description: "Telefone do usuário." },
            { name: "action", type: "string", required: true, description: "Deve ser 'edit_category'.", values: ["edit_category"] },
            { name: "old_name", type: "string", required: true, description: "Nome atual da categoria." },
            { name: "new_name", type: "string", required: true, description: "Novo nome desejado." },
            { name: "parent_name", type: "string", required: false, description: "Nova categoria pai (para mover)." },
        ],
        curlCommand: `curl -X POST "${BASE}/manage-categories" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "uuid-do-usuario",
    "action": "edit_category",
    "old_name": "Academia Velha",
    "new_name": "Academia Nova",
    "parent_name": "Saúde"
  }'`,
        responseExample: `{ "success": true, "data": { "id": "uuid", "name": "Academia Nova" } }`,
        errors: [
            { code: 404, message: "Categoria alvo não encontrada", cause: "O old_name não corresponde a nenhuma categoria.", fix: "Liste com list_categories e copie o nome exato." },
        ],
    },

    // ── 7. MANAGE CATEGORIES: Excluir ───────
    {
        method: "POST",
        path: "/manage-categories (Excluir Categoria)",
        summary: "Remove permanentemente uma categoria do usuário.",
        description: `Exclui uma categoria de forma irreversível. A busca é por nome exato (case-insensitive).

CUIDADO: Esta ação não pode ser desfeita.`,
        params: [
            { name: "user_id", type: "uuid", required: false, description: "UUID do usuário." },
            { name: "phone", type: "string", required: false, description: "Telefone do usuário." },
            { name: "action", type: "string", required: true, description: "Deve ser 'delete_category'.", values: ["delete_category"] },
            { name: "name", type: "string", required: true, description: "Nome exato da categoria a excluir." },
        ],
        curlCommand: `curl -X POST "${BASE}/manage-categories" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "uuid-do-usuario",
    "action": "delete_category",
    "name": "Academia"
  }'`,
        responseExample: `{ "success": true, "message": "Categoria excluída com sucesso." }`,
        errors: [
            { code: 404, message: "Categoria não encontrada", cause: "O nome informado não existe.", fix: "Liste com list_categories primeiro." },
        ],
    },

    // ── 8. MANAGE ACCOUNTS: Listar ──────────
    {
        method: "GET",
        path: "/manage-accounts-by-phone",
        summary: "Lista bancos e cartões de crédito do usuário. Necessário para obter os IDs usados nas transações.",
        description: `Retorna todas as contas bancárias (bank_accounts) e cartões de crédito (credit_cards) cadastrados.

Retorna também o balanço atualizado ("balance") que o banco tem com base nos cálculos de receitas e despesas registradas no banco em todo o período histórico.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Número de telefone do usuário (query param)." },
        ],
        curlCommand: `curl -X GET "${BASE}/manage-accounts-by-phone?phone=5511999999999" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"`,
        responseExample: `{
  "bank_accounts": [
    { "id": "uuid-banco-1", "name": "Nubank", "color": "#8B5CF6", "balance": 1540.50 },
    { "id": "uuid-banco-2", "name": "Inter", "color": "#F97316", "balance": -300.00 }
  ],
  "credit_cards": [
    { "id": "uuid-cartao-1", "name": "Visa Gold", "closing_day": 15, "due_day": 25 }
  ]
}`,
        errors: [
            { code: 404, message: "Usuário não encontrado", cause: "Telefone não cadastrado.", fix: "Confirme o telefone com formato 5511999999999." },
        ],
        tips: "💡 Sempre chame esta API antes de criar transações para obter os IDs corretos.",
    },

    // ── 8B. MANAGE ACCOUNTS: Resumo de Cartões ──
    {
        method: "GET",
        path: "/manage-accounts-by-phone?action=get_card_summary",
        summary: "Consulta limite disponível, gasto acumulado e histórico de transações por cartão de crédito.",
        description: `Retorna um resumo financeiro detalhado para cada cartão de crédito do usuário:
• Limite total (card_limit)
• Total gasto (total_spent)
• Limite disponível (available_limit)
• Percentual de uso (usage_percentage)
• Histórico completo de transações do cartão

FILTROS DISPONÍVEIS (query params):
• card_id → Filtra por um cartão específico
• bank_account_id → Filtra transações associadas a um banco
• month → Filtra por mês no formato YYYY-MM (ex: 2026-03)
• limit → Máximo de transações retornadas (padrão: 100, máx: 500)

Se nenhum filtro for passado, retorna o resumo de TODOS os cartões.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário (query param)." },
            { name: "action", type: "string", required: true, description: "Deve ser 'get_card_summary'.", values: ["get_card_summary"] },
            { name: "card_id", type: "uuid", required: false, description: "Filtrar por um cartão específico." },
            { name: "bank_account_id", type: "uuid", required: false, description: "Filtrar transações vinculadas a um banco." },
            { name: "month", type: "string", required: false, description: "Filtrar por mês (YYYY-MM). Ex: 2026-03." },
            { name: "limit", type: "number", required: false, description: "Máximo de transações retornadas (padrão: 100, máx: 500)." },
        ],
        curlCommand: `# ── Resumo de TODOS os cartões ──
curl -X GET "${BASE}/manage-accounts-by-phone?phone=5511999999999&action=get_card_summary" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"

# ── Resumo de um cartão específico no mês de Março ──
curl -X GET "${BASE}/manage-accounts-by-phone?phone=5511999999999&action=get_card_summary&card_id=uuid-do-cartao&month=2026-03" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"`,
        responseExample: `{
  "success": true,
  "filters_applied": { "card_id": "todos", "bank_account_id": "todos", "month": "2026-03" },
  "cards": [
    {
      "card_id": "uuid-cartao",
      "card_name": "Nubank Crédito",
      "card_limit": 5000.00,
      "total_fatura": 1280.50,
      "total_spent": 1280.50,
      "available_limit": 3719.50,
      "usage_percentage": 25.61,
      "transaction_count": 8,
      "transactions": [
        { "id": "uuid", "amount": 85.90, "type": "expense", "description": "Supermercado", "category": "alimentacao", "date": "2026-03-10" }
      ]
    }
  ],
  "total_cards": 1
}`,
        errors: [
            { code: 404, message: "Cartão não encontrado", cause: "O card_id informado não pertence ao usuário.", fix: "Obtenha os IDs via GET /manage-accounts-by-phone (sem action)." },
            { code: 404, message: "Nenhum cartão cadastrado", cause: "O usuário não possui cartões de crédito.", fix: "Crie um cartão com action='create_card'." },
        ],
        tips: "💡 Sem filtro de mês, retorna transações de TODO o histórico. Use 'month=2026-03' para limitar ao mês. O campo 'total_fatura' exclui pagamentos de fatura para evitar duplicidade. O 'usage_percentage' é nulo se o cartão não tem limite definido.",
    },

    // ── 8C. MANAGE ACCOUNTS: Consultar Fatura Detalhada ──
    {
        method: "GET",
        path: "/manage-accounts-by-phone?action=get_fatura",
        summary: "Consulta a fatura de um cartão com total e detalhe das transações. Retorna texto ou HTML/PDF dependendo do volume.",
        description: `Retorna a fatura detalhada de um cartão. O formato da resposta é automático:

• ≤ 4 transações → Retorna JSON com campo "summary" em texto legível (pronto para enviar no WhatsApp).
• ≥ 5 transações ou format=pdf → Retorna HTML codificado em base64 para gerar PDF no navegador.

FILTROS DISPONÍVEIS (query params):
• card_id → (Obrigatório) UUID do cartão
• month → Filtrar por mês no formato YYYY-MM (ex: 2026-03)
• format=pdf → Forçar retorno em PDF mesmo com poucas transações`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário (query param)." },
            { name: "action", type: "string", required: true, description: "Deve ser 'get_fatura'.", values: ["get_fatura"] },
            { name: "card_id", type: "uuid", required: true, description: "UUID do cartão a consultar." },
            { name: "month", type: "string", required: false, description: "Filtrar por mês (YYYY-MM). Ex: 2026-03." },
            { name: "format", type: "string", required: false, description: "Use 'pdf' para forçar retorno em HTML/PDF.", values: ["pdf"] },
        ],
        curlCommand: `# ── Consulta de fatura (texto, até 4 transações) ──
curl -X GET "${BASE}/manage-accounts-by-phone?phone=5511999999999&action=get_fatura&card_id=uuid-do-cartao&month=2026-03" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>"

# ── Consulta forçando retorno em PDF ──
curl -X GET "${BASE}/manage-accounts-by-phone?phone=5511999999999&action=get_fatura&card_id=uuid-do-cartao&month=2026-03&format=pdf" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>"`,
        responseExample: `// ─── Resposta TEXTO (≤4 transações) ───
{
  "success": true,
  "format": "text",
  "card_name": "Inter",
  "month": "2026-03",
  "total_fatura": 850.00,
  "transaction_count": 3,
  "summary": "📋 Fatura Inter — 2026-03\\n─────────────────────────\\n1. Compra de celular (1/2) — R$ 300,00 em 2026-03-23\\n2. Supermercado — R$ 250,00 em 2026-03-18\\n3. Gasolina — R$ 300,00 em 2026-03-10\\n─────────────────────────\\n💳 Total da fatura: R$ 850,00"
}

// ─── Resposta PDF (≥5 transações ou format=pdf) ───
{
  "success": true,
  "format": "pdf",
  "card_name": "Inter",
  "month": "2026-03",
  "total_fatura": 2350.00,
  "transaction_count": 8,
  "pdf_url": "https://dlbiwguzbiosaoyrcvay.supabase.co/storage/v1/object/sign/temp_pdfs/fatura_id_da_fatura.pdf",
  "message": "Acesse o link no navegador para baixar o PDF. Este link expira em 24h."
}`,
        errors: [
            { code: 400, message: "card_id obrigatório", cause: "Parâmetro card_id não informado.", fix: "Passe card_id=uuid-do-cartao na query string." },
            { code: 404, message: "Cartão não encontrado", cause: "UUID inválido ou não pertence ao usuário.", fix: "Obtenha os IDs via GET sem action." },
        ],
        tips: "💡 O campo 'summary' da resposta texto está formatado para envio direto pelo WhatsApp. Para o PDF, abra a 'pdf_url' listada (Link Assinado dinâmico gerado pelo servidor) que expira em 1 dia.",
    },

    // ── 9. MANAGE ACCOUNTS: Criar Banco ─────
    {
        method: "POST",
        path: "/manage-accounts-by-phone",
        summary: "Cria um novo banco institucional para o usuário.",
        description: `Cria uma conta bancária associada ao usuário. O UUID retornado pode ser usado em transações.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário." },
            { name: "action", type: "string", required: true, description: "Deve ser 'create_bank'.", values: ["create_bank"] },
            { name: "name", type: "string", required: true, description: "Nome do banco. Ex: Nubank, Inter." },
            { name: "balance", type: "number", required: false, description: "Saldo inicial (padrão: 0)." },
        ],
        curlCommand: `curl -X POST "${BASE}/manage-accounts-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "action": "create_bank",
    "name": "Nubank",
    "balance": 500.00
  }'`,
        responseExample: `{ "success": true, "data": { "id": "uuid-novo-banco", "name": "Nubank" } }`,
        errors: [
            { code: 400, message: "Campos obrigatórios faltando", cause: "Faltou phone, action ou name.", fix: "Envie: phone, action='create_bank', name." },
        ],
    },

    // ── 9A. MANAGE ACCOUNTS: Criar Cartão ─────
    {
        method: "POST",
        path: "/manage-accounts-by-phone (Criar Cartão)",
        summary: "Cria um novo cartão de crédito para o usuário.",
        description: `Cria um cartão de crédito associado ao usuário. Opcionalmente já pode ser vinculado a uma conta bancária enviando o bank_account_id.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário." },
            { name: "action", type: "string", required: true, description: "Deve ser 'create_card'.", values: ["create_card"] },
            { name: "name", type: "string", required: true, description: "Nome do cartão. Ex: Nubank Crédito." },
            { name: "closing_day", type: "number", required: true, description: "Dia do fechamento da fatura (1-31)." },
            { name: "due_day", type: "number", required: true, description: "Dia do vencimento da fatura (1-31)." },
            { name: "card_limit", type: "number", required: false, description: "Limite de crédito do cartão." },
            { name: "bank_account_id", type: "uuid", required: false, description: "UUID do banco para vincular." },
        ],
        curlCommand: `curl -X POST "${BASE}/manage-accounts-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "action": "create_card",
    "name": "Nubank Crédito",
    "closing_day": 3,
    "due_day": 10
  }'`,
        responseExample: `{ "success": true, "message": "💳 Cartão Nubank Crédito criado com sucesso!", "credit_card": { "id": "uuid-cartao", ... } }`,
        errors: [
            { code: 400, message: "Campos obrigatórios faltando", cause: "Faltou closing_day ou due_day.", fix: "Sempre envie os dias de fechamento e vencimento." },
        ],
    },

    // ── 9B. MANAGE ACCOUNTS: Vincular Cartão ──
    {
        method: "POST",
        path: "/manage-accounts-by-phone (Vincular Cartão)",
        summary: "Vincula um cartão de crédito a uma conta bancária (débito automático em fatura).",
        description: `Permite associar um cartão existente a um banco existente. Muito útil para que comandos de Pagar Fatura saibam de onde debitar.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário." },
            { name: "action", type: "string", required: true, description: "Deve ser 'link_card'.", values: ["link_card"] },
            { name: "card_id", type: "uuid", required: true, description: "UUID do cartão de crédito (obtido via GET accounts)." },
            { name: "bank_account_id", type: "uuid", required: true, description: "UUID do banco a ser vinculado." },
        ],
        curlCommand: `curl -X POST "${BASE}/manage-accounts-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "action": "link_card",
    "card_id": "uuid-do-cartao",
    "bank_account_id": "uuid-do-banco"
  }'`,
        responseExample: `{ "success": true, "message": "Cartão vinculado com sucesso!", "credit_card": { "bank_account_id": "..." } }`,
        errors: [
            { code: 400, message: "Faltando IDs", cause: "card_id ou bank_account_id ausente.", fix: "Envie os UUIDs obrigatórios." },
        ],
    },

    // ── 9C. MANAGE ACCOUNTS: Pagar Fatura ─────
    {
        method: "POST",
        path: "/manage-accounts-by-phone (Pagar Fatura)",
        summary: "Realiza o pagamento de uma fatura de cartão de crédito de forma inteligente.",
        description: `Gera uma transação de débito no banco vinculado ao cartão de crédito. Se a fatura já constar como paga neste mês, a API retorna erro impedindo pagamento duplicado.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário." },
            { name: "action", type: "string", required: true, description: "Deve ser 'pay_invoice'.", values: ["pay_invoice"] },
            { name: "card_id", type: "uuid", required: true, description: "UUID do cartão associado." },
            { name: "month_name", type: "string", required: true, description: "Nome do mês e ano da fatura. Ex: 'Abril 2026'." },
            { name: "amount", type: "number", required: true, description: "Valor exato a ser debitado." },
        ],
        curlCommand: `curl -X POST "${BASE}/manage-accounts-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "action": "pay_invoice",
    "card_id": "uuid-do-cartao",
    "month_name": "Fevereiro 2026",
    "amount": 1400.50
  }'`,
        responseExample: `{ "success": true, "message": "Fatura paga com sucesso! R$ 1400.50 debitados." }`,
        errors: [
            { code: 400, message: "Cartão não possui conta bancária", cause: "Não há bank_account_id no cartão.", fix: "Vincule uma conta primeiro usando 'link_card' ou via Interface Web." },
            { code: 400, message: "Esta fatura já foi paga", cause: "Sistema detectou um pagamento prévio com a mesma descrição e cartão.", fix: "Pagamento duplicado evitado nativamente." },
        ],
        tips: "💡 É fortemente recomendado vincular cartões de crédito às contas bancárias na aba 'Cartões' para poder usufruir de Automações N8N de Pagamento de Fatura sem intervenção manual.",
    },

    // ── 10. ADD TRANSACTION ─────────────────
    {
        method: "POST",
        path: "/add-transaction-by-phone",
        summary: "Cria uma nova transação (receita ou despesa). Suporta parcelas, fixas e transferências.",
        description: `Endpoint principal para registrar qualquer movimentação financeira.

TIPOS DE TRANSAÇÃO:
• Simples → type, amount, category, payment_method, date
• Parcelada → + total_installments + credit_card_id
• Fixa/Mensal → + is_fixed=true + fixed_months (2 a 60)
• Transferência → type="expense", category="transferencia", payment_method="transfer"

MÉTODOS DE PAGAMENTO:
• debit → Débito (requer bank_account_id)
• pix → PIX (requer bank_account_id)
• credit → Cartão de crédito (requer credit_card_id)
• boleto → Boleto (requer bank_account_id)
• transfer → Transferência entre contas (requer bank_account_id)

REGRAS:
• credit → envie credit_card_id (NÃO bank_account_id)
• outros → envie bank_account_id (NÃO credit_card_id)
• Formato de data: YYYY-MM-DD`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário." },
            { name: "type", type: "string", required: true, description: "Tipo da transação.", values: ["income", "expense"] },
            { name: "amount", type: "number", required: true, description: "Valor em reais. Ex: 150.80" },
            { name: "category", type: "string", required: true, description: "Nome da categoria (slug). Ex: supermercado" },
            { name: "payment_method", type: "string", required: true, description: "Método de pagamento.", values: ["debit", "pix", "credit", "boleto", "transfer"] },
            { name: "description", type: "string", required: false, description: "Descrição livre." },
            { name: "date", type: "string", required: false, description: "Data YYYY-MM-DD. Padrão: hoje." },
            { name: "bank_account_id", type: "uuid", required: false, description: "UUID do banco. Obrigatório (exceto para format credit)." },
            { name: "credit_card_id", type: "uuid", required: false, description: "UUID do cartão. Obrigatório se payment_method=credit." },
            { name: "is_fixed", type: "boolean", required: false, description: "Se for true, insere os próximos meses automaticamente como despesa fixa." },
            { name: "fixed_months", type: "number", required: false, description: "Para is_fixed=true: Quantos meses lançar (2 a 60). Padrão: ignorado se is_fixed=false." },
            { name: "total_installments", type: "number", required: false, description: "Para credit: Número de parcelas. Ex: 5 (para compra parcelada em 5x)." },
        ],
        curlCommand: `# ── DESPESA SIMPLES (débito) ──
curl -X POST "${BASE}/add-transaction-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "type": "expense",
    "amount": 85.90,
    "category": "supermercado",
    "payment_method": "debit",
    "description": "Compras da semana",
    "date": "2026-03-10",
    "bank_account_id": "uuid-do-banco"
  }'

# ── PARCELAMENTO NO CARTÃO (3x) ──
curl -X POST "${BASE}/add-transaction-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "type": "expense",
    "amount": 450.00,
    "category": "eletronicos",
    "payment_method": "credit",
    "description": "Fone Bluetooth",
    "credit_card_id": "uuid-do-cartao",
    "total_installments": 3
  }'

# ── RECEITA FIXA (salário, 12 meses) ──
curl -X POST "${BASE}/add-transaction-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "type": "income",
    "amount": 3500.00,
    "category": "salario",
    "description": "Salário mensal",
    "date": "2026-03-05",
    "bank_account_id": "uuid-do-banco",
    "is_fixed": true,
    "fixed_months": 12
  }'

# ── TRANSFERÊNCIA ──
curl -X POST "${BASE}/add-transaction-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "type": "expense",
    "amount": 200.00,
    "category": "transferencia",
    "payment_method": "transfer",
    "bank_account_id": "uuid-do-banco-origem"
  }'`,
        responseExample: `{
  "success": true,
  "transaction": { "id": "uuid", "type": "expense", "amount": 85.90, "date": "2026-03-10" },
  "budget_alert": {
    "status": "warning",
    "percentage": 85.9,
    "message": "⚠️ Atenção! Você gastou 86% do seu teto de supermercado.",
    "limit": 100,
    "total_spent": 85.90
  }
}`,
        errors: [
            { code: 404, message: "Usuário não encontrado", cause: "Telefone incorreto.", fix: "Confirme com /get-user-by-phone." },
            { code: 400, message: "Campos obrigatórios faltando", cause: "Faltou type, amount ou category.", fix: "Envie: phone, type, amount, category, payment_method." },
            { code: 400, message: "Método de pagamento inválido", cause: "Valor não aceito.", fix: "Use: debit, pix, credit, boleto ou transfer." },
            { code: 400, message: "credit_card_id é obrigatório", cause: "payment_method='credit' sem credit_card_id.", fix: "Obtenha via /manage-accounts-by-phone." },
            { code: 400, message: "bank_account_id é obrigatório", cause: "debit/pix/boleto/transfer sem bank_account_id.", fix: "Obtenha via /manage-accounts-by-phone." },
        ],
        tips: "💡 Para receitas, payment_method é opcional. Transferências: SEMPRE type='expense', category='transferencia', payment_method='transfer'.",
    },

    // ── 11. GET TRANSACTIONS ────────────────
    {
        method: "GET",
        path: "/get-transactions-by-phone",
        summary: "Retorna o extrato de transações do mês atual com saldos e totais.",
        description: `Retorna as transações do mês corrente com receitas, despesas e saldo líquido. Ao passar o parâmetro \`bank\` ou \`bank_account_id\`, você recebe perfeitamente apenas o extrato referente àquele banco e as somas daquele banco específico.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário (query param)." },
            { name: "bank", type: "string", required: false, description: "Filtro opcional. Pode ser o nome do banco (ex: 'Nubank') ou o seu respectivo ID (bank_account_id)." },
        ],
        curlCommand: `# Obter Todas as transações do mês
curl -X GET "${BASE}/get-transactions-by-phone?phone=5511999999999" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"
  
# Obter Apenaso Extrato de um Banco
curl -X GET "${BASE}/get-transactions-by-phone?phone=5511999999999&bank=Nubank" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"`,
        responseExample: `{
  "transactions": [...],
  "total_income": 3500.00,
  "total_expenses": 1250.80,
  "balance": 2249.20
}`,
        errors: [
            { code: 404, message: "Usuário não encontrado", cause: "Telefone incorreto.", fix: "Confirme com /get-user-by-phone." },
        ],
        tips: "💡 Usar o param ?bank=Nome é ideal para consultar o balanço específico que a pessoa tem guardado e o quanto entrou e saiu somente desta conta."
    },

    // ── 12. UPDATE TRANSACTION ──────────────
    {
        method: "PUT",
        path: "/update-transaction-by-phone",
        summary: "Atualiza campos de uma transação existente (valor, data, descrição).",
        description: `Permite corrigir qualquer campo. Envie apenas os campos que deseja alterar.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário." },
            { name: "transaction_id", type: "uuid", required: true, description: "UUID da transação (obtido via /get-transactions-by-phone)." },
            { name: "amount", type: "number", required: false, description: "Novo valor." },
            { name: "description", type: "string", required: false, description: "Nova descrição." },
            { name: "category", type: "string", required: false, description: "Nova categoria." },
            { name: "date", type: "string", required: false, description: "Nova data (YYYY-MM-DD)." },
        ],
        curlCommand: `curl -X PUT "${BASE}/update-transaction-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "transaction_id": "uuid-da-transacao",
    "amount": 180.50,
    "description": "Valor corrigido"
  }'`,
        responseExample: `{ "success": true, "data": { "id": "uuid", "amount": 180.50 } }`,
        errors: [
            { code: 404, message: "Transação não encontrada", cause: "UUID incorreto ou não pertence ao usuário.", fix: "Obtenha via /get-transactions-by-phone." },
        ],
    },

    // ── 13. DELETE TRANSACTION ──────────────
    {
        method: "DELETE",
        path: "/cancel-transaction-by-phone",
        summary: "Remove permanentemente (estorna) uma transação do histórico.",
        description: `Exclui uma transação de forma irreversível. O transaction_id é obtido via /get-transactions-by-phone.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário." },
            { name: "transaction_id", type: "uuid", required: true, description: "UUID da transação a remover." },
        ],
        curlCommand: `curl -X DELETE "${BASE}/cancel-transaction-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "transaction_id": "uuid-da-transacao"
  }'`,
        responseExample: `{ "success": true, "message": "Transação removida com sucesso." }`,
        errors: [
            { code: 404, message: "Transação não encontrada", cause: "UUID incorreto ou já excluída.", fix: "Liste com /get-transactions-by-phone." },
        ],
    },

    // ── 14. ADD APPOINTMENT ─────────────────
    {
        method: "POST",
        path: "/add-appointment",
        summary: "Cria um agendamento/lembrete de conta a pagar ou receber, com horário opcional.",
        description: `Adiciona um lembrete vinculado ao usuário. Útil para contas futuras ou compromissos.

O campo amount é totalmente OPCIONAL — não precisa enviar se não souber o valor.
Aceita horário (time) para agendamentos com hora específica no formato HH:mm. Se não enviar, será dia inteiro.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário." },
            { name: "title", type: "string", required: true, description: "Título do agendamento. Ex: 'Pagar aluguel'." },
            { name: "amount", type: "number", required: false, description: "Valor associado (OPCIONAL). Não precisa enviar." },
            { name: "date", type: "string", required: true, description: "Data do agendamento (YYYY-MM-DD)." },
            { name: "time", type: "string", required: false, description: "Horário (HH:mm 24h). Ex: '14:30'. Opcional." },
            { name: "time_end", type: "string", required: false, description: "Horário de término (HH:mm). Ex: '15:30'. Opcional." },
            { name: "type", type: "string", required: false, description: "Tipo do lembrete.", values: ["payment", "receive"] },
            { name: "description", type: "string", required: false, description: "Descrição adicional." },
        ],
        curlCommand: `# ── Lembrete simples (sem valor, sem horário) ──
curl -X POST "${BASE}/add-appointment" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "title": "Reunião com contador",
    "date": "2026-04-10",
    "description": "Revisão fiscal trimestral"
  }'

# ── Lembrete com valor e horário ──
curl -X POST "${BASE}/add-appointment" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "title": "Pagar aluguel",
    "amount": 1200.00,
    "date": "2026-04-10",
    "time": "09:00",
    "type": "payment",
    "description": "Vence dia 10 de cada mês"
  }'`,
        responseExample: `{ "success": true, "data": { "id": "uuid", "title": "Pagar aluguel" } }`,
        errors: [
            { code: 400, message: "Campos obrigatórios faltando", cause: "Faltou phone, title ou date.", fix: "Envie: phone, title, date (YYYY-MM-DD). O amount é OPCIONAL." },
        ],
        tips: "💡 O amount e time são totalmente opcionais. Use time no formato HH:mm (24h).",
    },

    // ── 15. GET APPOINTMENTS ────────────────
    {
        method: "GET",
        path: "/get-appointments-by-phone",
        summary: "Lista todos os agendamentos e lembretes pendentes do usuário.",
        description: `Retorna a lista completa de agendamentos, ordenada por data.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário (query param)." },
        ],
        curlCommand: `curl -X GET "${BASE}/get-appointments-by-phone?phone=5511999999999" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"`,
        responseExample: `{
  "appointments": [
    { "id": "uuid", "title": "Pagar aluguel", "date": "2026-04-10", "time": "09:00", "status": "pending" }
  ]
}`,
        errors: [
            { code: 404, message: "Usuário não encontrado", cause: "Telefone incorreto.", fix: "Confirme com /get-user-by-phone." },
        ],
    },

    // ── 16. UPDATE APPOINTMENT ──────────────
    {
        method: "PUT",
        path: "/update-appointment-by-phone",
        summary: "Atualiza o status de um agendamento (pendente → concluído, etc).",
        description: `Permite alterar o status de um agendamento existente.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário." },
            { name: "appointment_id", type: "uuid", required: true, description: "UUID do agendamento (de /get-appointments-by-phone)." },
            { name: "status", type: "string", required: true, description: "Novo status.", values: ["pending", "completed", "cancelled"] },
        ],
        curlCommand: `curl -X PUT "${BASE}/update-appointment-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "appointment_id": "uuid-do-agendamento",
    "status": "completed"
  }'`,
        responseExample: `{ "success": true, "data": { "id": "uuid", "status": "completed" } }`,
        errors: [
            { code: 404, message: "Agendamento não encontrado", cause: "UUID incorreto.", fix: "Liste com /get-appointments-by-phone." },
        ],
    },

    // ── 17. DELETE APPOINTMENT ──────────────
    {
        method: "DELETE",
        path: "/delete-appointment",
        summary: "Exclui permanentemente um agendamento do usuário.",
        description: `Remove um agendamento de forma irreversível.`,
        params: [
            { name: "phone", type: "string", required: true, description: "Telefone do usuário." },
            { name: "appointment_id", type: "uuid", required: true, description: "UUID do agendamento." },
        ],
        curlCommand: `curl -X DELETE "${BASE}/delete-appointment" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "appointment_id": "uuid-do-agendamento"
  }'`,
        responseExample: `{ "success": true, "message": "Agendamento excluído com sucesso." }`,
        errors: [
            { code: 404, message: "Agendamento não encontrado", cause: "UUID incorreto ou já excluído.", fix: "Liste com /get-appointments-by-phone." },
        ],
    },
];

/* ─────────────────────────────────────────────
   MAIN PAGE COMPONENT
───────────────────────────────────────────── */
export default function ApiDocsPage() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");

    const filtered = useMemo(() => {
        if (!searchTerm.trim()) return endpoints;
        const lower = searchTerm.toLowerCase();
        return endpoints.filter(
            ep => ep.path.toLowerCase().includes(lower) ||
                ep.summary.toLowerCase().includes(lower) ||
                ep.description.toLowerCase().includes(lower) ||
                ep.method.toLowerCase().includes(lower)
        );
    }, [searchTerm]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-6 flex flex-col items-center">
            {/* Top Header */}
            <div className="w-full max-w-7xl mb-6">
                <Button variant="outline" onClick={() => navigate(-1)} className="mb-4 text-slate-900">
                    <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Documentação da API <span className="text-blue-500">n8n / IA</span></h1>
                        <p className="text-slate-400">Referência completa com parâmetros, exemplos de resposta e guia de resolução de erros.</p>
                    </div>
                    <Badge variant="outline" className="text-slate-400 border-slate-700 mt-2 md:mt-0 shrink-0">
                        {endpoints.length} Endpoints
                    </Badge>
                </div>
            </div>

            <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Guide + Test Console */}
                <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
                    {/* Quick Start */}
                    <Card className="bg-slate-900 border-slate-800 text-slate-200 shadow-md">
                        <CardHeader className="bg-slate-800/20 border-b border-slate-800/50 pb-4">
                            <CardTitle className="text-xl text-foreground flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-400" /> Quick Start</CardTitle>
                            <CardDescription className="text-slate-400">Passo a passo para começar a usar a API</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3 text-sm">
                            <div className="flex gap-3 items-start bg-slate-950 p-3 rounded-md border border-slate-800">
                                <Badge className="bg-blue-600 text-white shrink-0">1</Badge>
                                <div>
                                    <p className="text-slate-200 font-medium">Obtenha o perfil do usuário</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Chame <code className="text-blue-400">/get-user-by-phone</code> com o telefone. Guarde o <code className="text-orange-400">user_id</code> retornado.</p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start bg-slate-950 p-3 rounded-md border border-slate-800">
                                <Badge className="bg-blue-600 text-white shrink-0">2</Badge>
                                <div>
                                    <p className="text-slate-200 font-medium">Descubra bancos e cartões</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Chame <code className="text-blue-400">/manage-accounts-by-phone</code> para obter os UUIDs de <code className="text-orange-400">bank_account_id</code> e <code className="text-orange-400">credit_card_id</code>.</p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start bg-slate-950 p-3 rounded-md border border-slate-800">
                                <Badge className="bg-blue-600 text-white shrink-0">3</Badge>
                                <div>
                                    <p className="text-slate-200 font-medium">Liste as categorias</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Chame <code className="text-blue-400">/manage-categories</code> com <code className="text-green-400">action: "list_categories"</code> para saber quais categorias o usuário tem.</p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start bg-slate-950 p-3 rounded-md border border-slate-800">
                                <Badge className="bg-green-600 text-white shrink-0">4</Badge>
                                <div>
                                    <p className="text-slate-200 font-medium">Crie transações, agendamentos, etc.</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Agora use os IDs obtidos para criar transações com <code className="text-blue-400">/add-transaction-by-phone</code> e agendamentos com <code className="text-blue-400">/add-appointment</code>.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* IA Logic Guide */}
                    <Card className="bg-slate-900 border-slate-800 text-slate-200 shadow-md">
                        <CardHeader className="bg-slate-800/20 border-b border-slate-800/50 pb-4">
                            <CardTitle className="text-xl text-foreground">Guia de Regras para IA</CardTitle>
                            <CardDescription className="text-slate-400">Regras que a IA deve seguir ao processar comandos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-4 text-sm leading-relaxed">
                            <div className="bg-slate-950 p-3 rounded-md border border-slate-800">
                                <h3 className="font-semibold text-blue-400 mb-1">🔁 Transferências</h3>
                                <p className="text-slate-300 text-xs">Sempre registre como <code className="text-orange-400">type: "expense"</code>, <code className="text-green-400">category: "transferencia"</code>, <code className="text-blue-400">payment_method: "transfer"</code>.</p>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-md border border-slate-800">
                                <h3 className="font-semibold text-blue-400 mb-1">📅 Despesas/Receitas Fixas</h3>
                                <p className="text-slate-300 text-xs">Envie <code className="text-purple-400">is_fixed: true</code> + <code className="text-purple-400">fixed_months: 12</code>. Não faça loops — a API cria todos os meses automaticamente.</p>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-md border border-slate-800">
                                <h3 className="font-semibold text-blue-400 mb-1">💳 Métodos de Pagamento</h3>
                                <p className="text-slate-300 text-xs">
                                    <code className="text-green-400">debit</code> <code className="text-green-400">pix</code> <code className="text-green-400">credit</code> <code className="text-green-400">boleto</code> <code className="text-green-400">transfer</code><br />
                                    <span className="text-slate-400 mt-1 block">credit → <code className="text-orange-400">credit_card_id</code> | outros → <code className="text-blue-400">bank_account_id</code></span>
                                </p>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-md border border-slate-800">
                                <h3 className="font-semibold text-blue-400 mb-1">🆔 Identificação do Usuário</h3>
                                <p className="text-slate-300 text-xs">
                                    A API aceita <code className="text-orange-400">user_id</code> (UUID) OU <code className="text-blue-400">phone</code>.<br />
                                    <span className="text-slate-400">Use sempre o user_id quando disponível — é mais rápido e confiável.</span>
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Common Errors Reference */}
                    <Card className="bg-slate-900 border-slate-800 shadow-md">
                        <CardHeader className="bg-slate-800/20 border-b border-slate-800/50 pb-4">
                            <CardTitle className="text-xl text-foreground flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-yellow-400" /> Referência de Erros HTTP
                            </CardTitle>
                            <CardDescription className="text-slate-400">O que cada código de erro significa</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-2 text-sm">
                            {[
                                { code: 400, label: "Bad Request", desc: "Dados do body estão incompletos ou inválidos. Verifique os campos obrigatórios e os valores aceitos." },
                                { code: 401, label: "Unauthorized", desc: "Header Authorization ausente ou token inválido. Verifique sua SUPABASE_ANON_KEY." },
                                { code: 404, label: "Not Found", desc: "O recurso (usuário, categoria, transação) não foi encontrado. Verifique os IDs/nomes enviados." },
                                { code: 500, label: "Internal Server Error", desc: "Erro no servidor. Pode ser uma coluna inexistente no banco ou bug na function. Verifique os logs no Supabase." },
                            ].map((err) => (
                                <div key={err.code} className="flex items-start gap-3 bg-slate-950 p-3 rounded-md border border-slate-800">
                                    <Badge className={`shrink-0 font-mono text-xs ${err.code < 500 ? "bg-yellow-900/50 text-yellow-300 border border-yellow-800" : "bg-red-900/50 text-red-300 border border-red-800"}`}>{err.code}</Badge>
                                    <div>
                                        <p className="text-slate-200 font-medium text-xs">{err.label}</p>
                                        <p className="text-slate-400 text-xs mt-0.5">{err.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Test Console */}
                    <Card className="bg-slate-900 border-slate-800 shadow-md">
                        <CardHeader className="bg-slate-800/20 border-b border-slate-800/50 pb-4">
                            <CardTitle className="text-xl text-foreground">Console de Teste</CardTitle>
                            <CardDescription className="text-slate-400">Teste as APIs diretamente daqui</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <ApiTestForm />
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Endpoints */}
                <div className="lg:col-span-7">
                    {/* Search */}
                    <div className="mb-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">Referência de Endpoints</h2>
                            <Badge variant="outline" className="text-slate-400 border-slate-700">{filtered.length} de {endpoints.length}</Badge>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Buscar endpoint... (ex: transação, categoria, appointment)"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Endpoint list */}
                    <div className="space-y-4">
                        {filtered.map((ep, idx) => <EndpointCard key={idx} ep={ep} />)}
                        {filtered.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Nenhum endpoint encontrado para "{searchTerm}"</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
