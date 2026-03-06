import { ApiTestForm } from "@/components/ApiTestForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ApiDocsPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex flex-col items-center">
            <div className="w-full max-w-5xl mb-6">
                <Button variant="outline" onClick={() => navigate(-1)} className="mb-4 text-slate-900">
                    <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <h1 className="text-3xl font-bold mb-2">Documentação da API (n8n / IA)</h1>
                <p className="text-slate-400">Página independente para consulta e testes da API do IAFÉ Finanças.</p>
            </div>

            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <Card className="bg-slate-900 border-slate-800 text-slate-200">
                        <CardHeader>
                            <CardTitle className="text-xl text-white">Regras de Negócio e I.A.</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed">
                            <div>
                                <h3 className="font-semibold text-white mb-1">1. Transferências</h3>
                                <p>O sistema não possui um endpoint separado para transferências. Uma transferência é registrada enviando uma despesa (<code className="bg-slate-800 px-1 rounded">expense</code>) com a categoria definida rigidamente como <code className="bg-slate-800 px-1 rounded">"transferencia"</code> e o método de pagamento <code className="bg-slate-800 px-1 rounded">"transfer"</code>. O ID do banco informado é a origem debitada.</p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-white mb-1">2. Categorias vs Grupos</h3>
                                <p>Para a IA, não fale em "Grupos". A IA deve extrair apenas o <code className="bg-slate-800 px-1 rounded">value</code> da categoria. Exemplo: O usuário fala "Mercado", a IA envia a categoria <code className="bg-slate-800 px-1 rounded">"supermercado"</code> na requisição.</p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-white mb-1">3. Cartão vs Conta Bancária</h3>
                                <p>Regra de ouro: Se o método for <code className="bg-slate-800 px-1 rounded">"credit"</code>, <b>NUNCA</b> envie <code className="bg-slate-800 px-1 rounded">bank_account_id</code>, use <code className="bg-slate-800 px-1 rounded">credit_card_id</code>. Opcionalmente envie <code className="bg-slate-800 px-1 rounded">total_installments</code> maior que 1 para compras parceladas.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800 text-slate-200">
                        <CardHeader>
                            <CardTitle className="text-xl text-white">Endpoints Disponíveis</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-0">
                            <div className="divide-y divide-slate-800">
                                <div className="p-4 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded font-bold">GET</span>
                                        <code className="text-sm font-semibold">/get-user-by-phone</code>
                                    </div>
                                    <p className="text-xs text-slate-400">Verifica se o usuário existe usando o telefone. Retorna IDs de bancos e cartões. Faça isso antes das transações se não os tiver em cache.</p>
                                </div>

                                <div className="p-4 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded font-bold">GET</span>
                                        <code className="text-sm font-semibold">/get-transactions-by-phone</code>
                                    </div>
                                    <p className="text-xs text-slate-400">Retorna um extrato. O objeto <code className="bg-slate-800 px-1 rounded">summary.balance</code> traz o saldo total líquido do usuário.</p>
                                </div>

                                <div className="p-4 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded font-bold">POST</span>
                                        <code className="text-sm font-semibold">/add-transaction-by-phone</code>
                                    </div>
                                    <p className="text-xs text-slate-400">Gera nova movimentação. Exige phone, type, amount e category.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div>
                    {/* Formulário Interativo que já existia na aplicação */}
                    <ApiTestForm />
                </div>
            </div>
        </div>
    );
}
