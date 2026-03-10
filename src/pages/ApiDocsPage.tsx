import { ApiTestForm } from "@/components/ApiTestForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, Copy, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const EndpointCard = ({ method, path, description, curlCommand }: { method: string, path: string, description: string, curlCommand: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(curlCommand);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const methodColors = {
        GET: "bg-blue-600 hover:bg-blue-700",
        POST: "bg-green-600 hover:bg-green-700",
        PUT: "bg-orange-600 hover:bg-orange-700",
        DELETE: "bg-red-600 hover:bg-red-700"
    };

    return (
        <Card className="bg-slate-900 border-slate-800 mb-4 overflow-hidden shadow-sm">
            <CardHeader className="p-4 bg-slate-800/30 border-b border-slate-800/50 flex flex-row items-center gap-3 space-y-0">
                <Badge className={`${methodColors[method as keyof typeof methodColors]} text-white font-mono`}>{method}</Badge>
                <code className="text-slate-200 font-semibold font-mono">{path}</code>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                <p className="text-sm text-slate-300">{description}</p>
                <div className="relative group rounded-md overflow-hidden bg-slate-950 border border-slate-800/50">
                    <pre className="p-4 text-xs font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap break-all">
                        {curlCommand}
                    </pre>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-2 right-2 h-8 w-8 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 hover:bg-slate-800 hover:text-foreground"
                        onClick={handleCopy}
                    >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default function ApiDocsPage() {
    const navigate = useNavigate();

    const endpoints = [
        {
            method: "GET",
            path: "/get-user-by-phone",
            description: "Busca o perfil do usuário, status, bancos e cartões vinculados usando o número de telefone. Deve ser o primeiro passo em novos fluxos.",
            curlCommand: `curl -X GET "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/get-user-by-phone?phone=5511999999999" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"`
        },
        {
            method: "GET",
            path: "/get-categories",
            description: "Listar árvore de categorias (Receitas/Despesas). Usado para mostrar à IA quais categorias existem na plataforma para efetuar transações.",
            curlCommand: `curl -X GET "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/get-categories" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"`
        },
        {
            method: "POST",
            path: "/manage-categories (Criar Categoria)",
            description: "Cria uma nova categoria principal (income ou expense) remotamente.",
            curlCommand: `curl -X POST "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/manage-categories" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "action": "create_category",
    "name": "Academia",
    "type": "expense"
  }'`
        },
        {
            method: "POST",
            path: "/manage-categories (Criar Subcategoria)",
            description: "Cria uma subcategoria vinculada a uma categoria pai existente.",
            curlCommand: `curl -X POST "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/manage-categories" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "action": "create_subcategory",
    "name": "Mensalidade",
    "parent_name": "Academia",
    "type": "expense"
  }'`
        },
        {
            method: "POST",
            path: "/manage-categories (Editar Categoria)",
            description: "Edita o nome (e opcionalmente o pai) de uma categoria ou subcategoria existente.",
            curlCommand: `curl -X POST "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/manage-categories" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "action": "edit_category",
    "old_name": "Academia Velha",
    "new_name": "Academia Nova",
    "parent_name": "Saúde", 
    "type": "expense"
  }'`
        },
        {
            method: "GET",
            path: "/manage-accounts-by-phone",
            description: "Lista as contas bancárias e cartões de crédito configurados pelo usuário.",
            curlCommand: `curl -X GET "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/manage-accounts-by-phone?phone=5511999999999" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"`
        },
        {
            method: "POST",
            path: "/manage-accounts-by-phone",
            description: "Cria um novo Banco Institucional para o usuário no sistema.",
            curlCommand: `curl -X POST "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/manage-accounts-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "action": "create_bank",
    "name": "Nubank",
    "balance": 500.00
  }'`
        },
        {
            method: "POST",
            path: "/add-transaction-by-phone",
            description: "Cria nova transação. Suporta Receitas/Despesas Fixas enviando is_fixed=true e fixed_months=X (ex: 12). Suporta parcelamento de cartão com total_installments.",
            curlCommand: `curl -X POST "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/add-transaction-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "type": "expense",
    "amount": 150.80,
    "category": "supermercado",
    "payment_method": "debit",
    "description": "Compra do churrasco",
    "date": "2024-03-01",
    "is_fixed": true,
    "fixed_months": 12,
    "bank_account_id": "uuid-da-conta"
  }'`
        },
        {
            method: "GET",
            path: "/get-transactions-by-phone",
            description: "Gera o extrato de transações do mês e o saldo geral da conta.",
            curlCommand: `curl -X GET "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/get-transactions-by-phone?phone=5511999999999" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"`
        },
        {
            method: "PUT",
            path: "/update-transaction-by-phone",
            description: "Atualiza ou corrige o valor, data ou detalhes de uma transação enviada por engano.",
            curlCommand: `curl -X PUT "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/update-transaction-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "transaction_id": "uuid-da-transacao",
    "amount": 180.50
  }'`
        },
        {
            method: "DELETE",
            path: "/cancel-transaction-by-phone",
            description: "Remove permanentemente (estorna) uma transação do histórico.",
            curlCommand: `curl -X DELETE "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/cancel-transaction-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "transaction_id": "uuid-da-transacao"
  }'`
        },
        {
            method: "POST",
            path: "/add-appointment",
            description: "Adiciona um agendamento / lembrete de conta a pagar ou receber vinculada ao telefone.",
            curlCommand: `curl -X POST "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/add-appointment" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "title": "Pagar aluguel",
    "amount": 1200.00,
    "date": "2024-04-10",
    "type": "payment",
    "description": "Lembrete mensal do aluguel"
  }'`
        },
        {
            method: "GET",
            path: "/get-appointments-by-phone",
            description: "Lista todos os agendamentos ou lembretes, facilitando saber o que está pendente no futuro do usuário.",
            curlCommand: `curl -X GET "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/get-appointments-by-phone?phone=5511999999999" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json"`
        },
        {
            method: "PUT",
            path: "/update-appointment-by-phone",
            description: "Muda o status do agendamento (ex: de pendente para concluído).",
            curlCommand: `curl -X PUT "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/update-appointment-by-phone" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "appointment_id": "uuid-do-agendamento",
    "status": "completed"
  }'`
        },
        {
            method: "DELETE",
            path: "/delete-appointment",
            description: "Cancela / apaga de vez um agendamento do usuário.",
            curlCommand: `curl -X DELETE "https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/delete-appointment" \\
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "appointment_id": "uuid-do-agendamento"
  }'`
        }
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex flex-col items-center">
            <div className="w-full max-w-7xl mb-6">
                <Button variant="outline" onClick={() => navigate(-1)} className="mb-4 text-slate-900">
                    <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Painel da API <span className="text-blue-500">n8n / IA</span></h1>
                        <p className="text-slate-400">Documentação interativa com construtor cURL para testar e guiar as IAs.</p>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Coluna da Esquerda: Lógica de IA e Testador */}
                <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
                    <Card className="bg-slate-900 border-slate-800 text-slate-200 shadow-md">
                        <CardHeader className="bg-slate-800/20 border-b border-slate-800/50 pb-4">
                            <CardTitle className="text-xl text-foreground">Guia de Intenções para IA</CardTitle>
                            <CardDescription className="text-slate-400">Como a IA deve processar os comandos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4 text-sm leading-relaxed">
                            <div className="bg-slate-950 p-3 rounded-md border border-slate-800">
                                <h3 className="font-semibold text-blue-400 mb-1 flex items-center gap-2">🔁 Transferências</h3>
                                <p className="text-slate-300">Sempre são faturadas como <code className="text-orange-400">expense</code>. O campo obrigatório da categoria é <code className="text-green-400">"transferencia"</code> e método de pagamento <code className="text-blue-400">"transfer"</code>.</p>
                            </div>

                            <div className="bg-slate-950 p-3 rounded-md border border-slate-800">
                                <h3 className="font-semibold text-blue-400 mb-1 flex items-center gap-2">📅 Despesas/Receitas Fixas</h3>
                                <p className="text-slate-300">Não precisa mais fazer "loops" de chamadas! Basta usar a API <code className="text-slate-100">/add-transaction-by-phone</code> enviando <code className="text-purple-400">is_fixed: true</code> e a quantidade de meses <code className="text-purple-400">fixed_months: 12</code> (ou 2 a 60).</p>
                            </div>

                            <div className="bg-slate-950 p-3 rounded-md border border-slate-800">
                                <h3 className="font-semibold text-blue-400 mb-1 flex items-center gap-2">💳 Cartão vs Banco</h3>
                                <p className="text-slate-300">Para cartão, use sempre <code className="text-orange-400">credit_card_id</code>. Para Pix/Débito/Boleto, use <code className="text-blue-400">bank_account_id</code>. Não envie os dois simultaneamente.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800 shadow-md">
                        <CardHeader className="bg-slate-800/20 border-b border-slate-800/50 pb-4">
                            <CardTitle className="text-xl text-foreground">Console de Teste</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <ApiTestForm />
                        </CardContent>
                    </Card>
                </div>

                {/* Coluna da Direita: Lista Interativa de Endpoints */}
                <div className="lg:col-span-7">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold">Referência de API (Endpoints)</h2>
                        <Badge variant="outline" className="text-slate-400 border-slate-700">{endpoints.length} Endpoints Mapeados</Badge>
                    </div>
                    <div className="space-y-4">
                        {endpoints.map((ep, idx) => (
                            <EndpointCard
                                key={idx}
                                method={ep.method}
                                path={ep.path}
                                description={ep.description}
                                curlCommand={ep.curlCommand}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
