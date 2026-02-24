import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? '';
const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Get the user from JWT
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Token de autenticação não encontrado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Get user from token
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Usuário não autenticado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get user's subscription
        const { data: subscription, error: subError } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (subError || !subscription) {
            return new Response(
                JSON.stringify({ error: 'Assinatura não encontrada' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (subscription.status === 'cancelled' || subscription.status === 'expired') {
            return new Response(
                JSON.stringify({ error: 'Assinatura já está cancelada' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const now = new Date();
        const isTrial = subscription.is_trial === true;

        // Cancel subscription in Asaas if exists
        if (subscription.asaas_subscription_id && ASAAS_API_KEY) {
            try {
                const cancelRes = await fetch(
                    `${ASAAS_BASE_URL}/subscriptions/${subscription.asaas_subscription_id}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'accept': 'application/json',
                            'access_token': ASAAS_API_KEY
                        }
                    }
                );
                const cancelData = await cancelRes.json();
                console.log('Asaas subscription cancel response:', cancelRes.status, cancelData);

                if (!cancelRes.ok && cancelRes.status !== 404) {
                    console.error('Failed to cancel Asaas subscription:', cancelData);
                    // Don't block - still cancel locally
                }
            } catch (e) {
                console.error('Error cancelling Asaas subscription:', e);
                // Don't block - still cancel locally
            }
        }

        // Update subscription in database
        if (isTrial) {
            // TRIAL: Cancel immediately - lose access now
            await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: 'cancelled',
                    cancelled_at: now.toISOString(),
                    cancel_at_period_end: false,
                    is_trial: false,
                    updated_at: now.toISOString()
                })
                .eq('id', subscription.id);

            console.log('Trial subscription cancelled immediately:', subscription.id);

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Período gratuito cancelado. Nenhuma cobrança foi feita.',
                    cancelledImmediately: true
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        } else {
            // PAID: Cancel at period end - keep access until current_period_end
            await supabaseAdmin
                .from('subscriptions')
                .update({
                    cancel_at_period_end: true,
                    cancelled_at: now.toISOString(),
                    updated_at: now.toISOString()
                })
                .eq('id', subscription.id);

            const periodEnd = subscription.current_period_end;
            console.log('Paid subscription will cancel at period end:', subscription.id, 'period_end:', periodEnd);

            return new Response(
                JSON.stringify({
                    success: true,
                    message: `Assinatura cancelada. Você ainda terá acesso até ${new Date(periodEnd).toLocaleDateString('pt-BR')}.`,
                    cancelledImmediately: false,
                    accessUntil: periodEnd
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

    } catch (error) {
        console.error('Error in cancel-subscription:', error);
        return new Response(
            JSON.stringify({ error: 'Erro interno. Tente novamente.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
