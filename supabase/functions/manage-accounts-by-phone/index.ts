import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bancos pré-cadastrados com cores
const BANK_PRESETS: Record<string, string> = {
    "nubank": "#8B5CF6", "itau": "#F97316", "itaú": "#F97316", "bradesco": "#DC2626",
    "banco do brasil": "#F59E0B", "bb": "#F59E0B", "caixa": "#2563EB", "caixa economica": "#2563EB",
    "santander": "#EF4444", "inter": "#EA580C", "c6": "#1E293B", "c6 bank": "#1E293B",
    "picpay": "#10B981", "mercado pago": "#2563EB", "btg": "#1E3A5F", "neon": "#06B6D4",
    "pagbank": "#16A34A", "pagseguro": "#16A34A", "next": "#22C55E", "sicoob": "#15803D",
    "sicredi": "#16A34A", "original": "#22C55E", "banrisul": "#2563EB", "safra": "#1E3A5F",
    "will bank": "#FACC15"
};

async function getUserIdByPhone(supabase: any, phone: string): Promise<string | null> {
    const n = phone.replace(/\D/g, '');
    const vars = [
        n, `+${n}`,
        n.length > 10 ? n.substring(2) : n,
        n.length === 12 && n.startsWith('55') ? `55${n.substring(2, 4)}9${n.substring(4)}` : null,
        n.length === 12 && n.startsWith('55') ? `+55${n.substring(2, 4)}9${n.substring(4)}` : null,
    ].filter(Boolean);
    for (const v of vars) {
        const { data, error } = await supabase.rpc('get_user_id_by_phone', { phone_number: v });
        if (!error && data) return data as string;
    }
    return null;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const url = new URL(req.url);

        // =====================
        // GET: Listar bancos e cartões
        // =====================
        if (req.method === 'GET') {
            const phone = url.searchParams.get('phone');
            if (!phone) {
                return new Response(
                    JSON.stringify({ error: 'Parâmetro phone obrigatório' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const userId = await getUserIdByPhone(supabase, phone);
            if (!userId) {
                return new Response(
                    JSON.stringify({ error: 'Usuário não encontrado', phone }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const action = url.searchParams.get('action');

            // ── GET CARD SUMMARY ──────────────────
            if (action === 'get_card_summary') {
                const cardIdFilter = url.searchParams.get('card_id');
                const bankFilter = url.searchParams.get('bank_account_id');
                const monthFilter = url.searchParams.get('month'); // formato: YYYY-MM
                const limitParam = url.searchParams.get('limit');
                const maxRows = limitParam ? Math.min(parseInt(limitParam), 500) : 100;

                // Buscar cartões do usuário (filtrado ou todos)
                let cardsQuery = supabase
                    .from('credit_cards')
                    .select('id, name, closing_day, due_day, card_limit, color')
                    .eq('user_id', userId);
                if (cardIdFilter) cardsQuery = cardsQuery.eq('id', cardIdFilter);

                const { data: userCards, error: cardsErr } = await cardsQuery.order('name');
                if (cardsErr || !userCards || userCards.length === 0) {
                    return new Response(
                        JSON.stringify({ error: cardIdFilter ? 'Cartão não encontrado' : 'Nenhum cartão cadastrado' }),
                        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                const cardIds = userCards.map((c: any) => c.id);

                // Buscar transações no cartão de crédito
                let txQuery = supabase
                    .from('transactions')
                    .select('id, amount, type, description, category, date, transaction_date, credit_card_id, bank_account_id, installment_number, total_installments')
                    .eq('user_id', userId)
                    .in('credit_card_id', cardIds)
                    .order('date', { ascending: false });

                if (bankFilter) txQuery = txQuery.eq('bank_account_id', bankFilter);
                if (monthFilter) {
                    const [year, month] = monthFilter.split('-').map(Number);
                    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
                    const endMonth = month === 12 ? 1 : month + 1;
                    const endYear = month === 12 ? year + 1 : year;
                    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
                    txQuery = txQuery.gte('date', startDate).lt('date', endDate);
                }

                txQuery = txQuery.limit(maxRows);

                const { data: cardTx } = await txQuery;

                // Calcular resumo por cartão
                const cardSummaries = userCards.map((card: any) => {
                    const cardTransactions = (cardTx || []).filter((t: any) => t.credit_card_id === card.id);
                    const totalSpent = cardTransactions.reduce((sum: number, t: any) => {
                        return sum + (t.type === 'expense' ? Number(t.amount) || 0 : 0);
                    }, 0);
                    const totalIncome = cardTransactions.reduce((sum: number, t: any) => {
                        return sum + (t.type === 'income' ? Number(t.amount) || 0 : 0);
                    }, 0);

                    const cardLimit = Number(card.card_limit) || 0;
                    const netSpent = totalSpent - totalIncome;
                    const availableLimit = cardLimit > 0 ? Math.max(0, cardLimit - netSpent) : null;

                    return {
                        card_id: card.id,
                        card_name: card.name,
                        color: card.color,
                        closing_day: card.closing_day,
                        due_day: card.due_day,
                        card_limit: cardLimit || null,
                        total_spent: Math.round(totalSpent * 100) / 100,
                        total_income: Math.round(totalIncome * 100) / 100,
                        net_spent: Math.round(netSpent * 100) / 100,
                        available_limit: availableLimit !== null ? Math.round(availableLimit * 100) / 100 : null,
                        usage_percentage: cardLimit > 0 ? Math.round((netSpent / cardLimit) * 10000) / 100 : null,
                        transaction_count: cardTransactions.length,
                        transactions: cardTransactions.map((t: any) => ({
                            id: t.id,
                            amount: t.amount,
                            type: t.type,
                            description: t.description,
                            category: t.category,
                            date: t.date,
                            installment_number: t.installment_number,
                            total_installments: t.total_installments,
                        }))
                    };
                });

                return new Response(
                    JSON.stringify({
                        success: true,
                        filters_applied: {
                            card_id: cardIdFilter || 'todos',
                            bank_account_id: bankFilter || 'todos',
                            month: monthFilter || 'todos',
                        },
                        cards: cardSummaries,
                        total_cards: cardSummaries.length,
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // ── LISTAGEM PADRÃO (bancos + cartões) ──
            const { data: banks } = await supabase
                .from('bank_accounts')
                .select('id, name, color, created_at')
                .eq('user_id', userId)
                .order('name');

            const { data: cards } = await supabase
                .from('credit_cards')
                .select('id, name, closing_day, due_day, card_limit, color, created_at')
                .eq('user_id', userId)
                .order('name');

            const { data: transactions } = await supabase
                .from('transactions')
                .select('amount, type, bank_account_id')
                .eq('user_id', userId)
                .not('bank_account_id', 'is', null);

            const banksWithBalance = (banks || []).map((bank: any) => {
                let income = 0;
                let expense = 0;

                (transactions || []).forEach((t: any) => {
                    if (t.bank_account_id === bank.id) {
                        const amount = Number(t.amount) || 0;
                        if (t.type === 'income') income += amount;
                        else if (t.type === 'expense') expense += amount;
                    }
                });

                return {
                    ...bank,
                    balance: income - expense,
                    income,
                    expense
                };
            });

            return new Response(
                JSON.stringify({
                    success: true,
                    bank_accounts: banksWithBalance,
                    credit_cards: cards || [],
                    total_banks: banks?.length || 0,
                    total_cards: cards?.length || 0,
                    available_presets: Object.keys(BANK_PRESETS).map(k => k.charAt(0).toUpperCase() + k.slice(1))
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // =====================
        // POST: Criar banco ou cartão
        // =====================
        if (req.method === 'POST') {
            const body = await req.json();
            const { phone, action, name, color, closing_day, due_day, card_limit, bank_account_id } = body;

            if (!phone || !action || !name) {
                return new Response(
                    JSON.stringify({
                        error: 'Campos obrigatórios: phone, action, name',
                        actions: ['create_bank', 'create_card'],
                        exemplo_banco: { phone: '5511999999999', action: 'create_bank', name: 'Nubank' },
                        exemplo_cartao: { phone: '5511999999999', action: 'create_card', name: 'Nubank Crédito', closing_day: 3, due_day: 10 }
                    }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const userId = await getUserIdByPhone(supabase, phone);
            if (!userId) {
                return new Response(
                    JSON.stringify({ error: 'Usuário não encontrado', phone }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            if (action === 'create_bank') {
                // Auto-detect color from preset
                const resolvedColor = color || BANK_PRESETS[name.toLowerCase()] || '#6B7280';

                const { data: bank, error: bankErr } = await supabase
                    .from('bank_accounts')
                    .insert({
                        user_id: userId,
                        name,
                        color: resolvedColor
                    })
                    .select()
                    .single();

                if (bankErr) {
                    return new Response(
                        JSON.stringify({ error: 'Erro ao criar banco', details: bankErr.message }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                return new Response(
                    JSON.stringify({
                        success: true,
                        message: `🏦 Banco "${name}" criado com sucesso!`,
                        bank_account: bank
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );

            } else if (action === 'create_card') {
                if (!closing_day || !due_day) {
                    return new Response(
                        JSON.stringify({
                            error: 'Para criar cartão de crédito, informe closing_day e due_day',
                            campos: {
                                closing_day: '(number) Dia do fechamento da fatura (1-31)',
                                due_day: '(number) Dia do vencimento da fatura (1-31)',
                                card_limit: '(number, opcional) Limite do cartão'
                            },
                            dica: 'Pergunte ao usuário: "Qual o dia de fechamento e o dia de vencimento da fatura?"'
                        }),
                        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                const resolvedColor = color || BANK_PRESETS[name.toLowerCase().split(' ')[0]] || '#6B7280';

                const { data: card, error: cardErr } = await supabase
                    .from('credit_cards')
                    .insert({
                        user_id: userId,
                        name,
                        closing_day: parseInt(closing_day),
                        due_day: parseInt(due_day),
                        card_limit: card_limit ? parseFloat(card_limit) : null,
                        color: resolvedColor
                    })
                    .select()
                    .single();

                if (cardErr) {
                    return new Response(
                        JSON.stringify({ error: 'Erro ao criar cartão', details: cardErr.message }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                return new Response(
                    JSON.stringify({
                        success: true,
                        message: `💳 Cartão "${name}" criado com sucesso!`,
                        credit_card: card
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );

            } else if (action === 'pay_invoice') {
                const { card_id, month_name, amount, bank_account_id } = body;
                if (!card_id || !month_name || amount === undefined || !bank_account_id) {
                    return new Response(JSON.stringify({ error: 'Informe card_id, month_name, amount e bank_account_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                if (amount <= 0) {
                    return new Response(JSON.stringify({ error: 'Valor da fatura deve ser maior que zero' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                // 1. Buscar o cartão para validar existencia
                const { data: card, error: cardErr } = await supabase
                    .from('credit_cards')
                    .select('id, name')
                    .eq('id', card_id)
                    .eq('user_id', userId)
                    .single();

                if (cardErr || !card) {
                    return new Response(JSON.stringify({ error: 'Cartão não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                // 2. Verificar se já foi paga
                const expenseDesc = `Fatura ${card.name} - ${month_name}`;
                const { data: existingPayment } = await supabase
                    .from("transactions")
                    .select("id")
                    .eq("user_id", userId)
                    .eq("payment_method", "debit")
                    .ilike("description", expenseDesc)
                    .maybeSingle();

                if (existingPayment) {
                    return new Response(JSON.stringify({ error: 'Esta fatura já foi paga' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                // 3. Inserir a despesa de pagamento
                const today = new Date().toISOString().split("T")[0];
                const { data: transaction, error: insertErr } = await supabase.from("transactions").insert({
                    user_id: userId,
                    type: "expense",
                    amount: amount,
                    category: "geral",
                    description: expenseDesc,
                    date: today,
                    transaction_date: today,
                    payment_method: "debit",
                    bank_account_id: bank_account_id,
                    total_installments: 1,
                    installment_number: 1
                }).select().single();

                if (insertErr) {
                    return new Response(JSON.stringify({ error: 'Erro ao registrar pagamento', details: insertErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                return new Response(JSON.stringify({ success: true, message: `Fatura paga com sucesso! R$ ${amount} debitados.`, transaction }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            } else {
                return new Response(
                    JSON.stringify({ error: `Ação "${action}" inválida`, actions: ['create_bank', 'create_card', 'pay_invoice'] }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Erro interno', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
