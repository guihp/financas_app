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

            return new Response(
                JSON.stringify({
                    success: true,
                    bank_accounts: banks || [],
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
            const { phone, action, name, color, closing_day, due_day, card_limit } = body;

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

            } else {
                return new Response(
                    JSON.stringify({ error: `Ação "${action}" inválida`, actions: ['create_bank', 'create_card'] }),
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
