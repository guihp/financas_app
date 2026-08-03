import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? '';
let ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3';

if (ASAAS_BASE_URL && !ASAAS_BASE_URL.endsWith('/v3') && !ASAAS_BASE_URL.endsWith('/v3/')) {
    ASAAS_BASE_URL = ASAAS_BASE_URL.replace(/\/$/, '') + '/v3';
}

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

        // Get user's subscription. Use maybeSingle + order/limit so a user with zero
        // subscriptions returns null (handled below) and one with duplicates does not throw.
        const { data: subscription, error: subError } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (subError || !subscription) {
            return new Response(
                JSON.stringify({ error: 'Assinatura não encontrada' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (subscription.status === 'cancelled') {
            return new Response(
                JSON.stringify({ error: 'Assinatura já está cancelada' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const now = new Date();
        const isTrial = subscription.is_trial === true;

        // Build the set of Asaas subscription ids to cancel. Prefer the linked id, but if it
        // is missing (partial-provisioning bug: Asaas billed the card but the id never got
        // saved locally) fall back to looking the customer's ACTIVE subscriptions up on Asaas.
        // Without this fallback the recurrence keeps charging the card after "cancel".
        const asaasSubIds: string[] = [];
        if (subscription.asaas_subscription_id) {
            asaasSubIds.push(subscription.asaas_subscription_id);
        }

        const needsAsaasCancel = !!subscription.asaas_subscription_id || !!subscription.asaas_customer_id;
        if (needsAsaasCancel && !ASAAS_API_KEY) {
            return new Response(
                JSON.stringify({ error: 'Configuração do Asaas não encontrada. Cancelamento não realizado.' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!subscription.asaas_subscription_id && subscription.asaas_customer_id && ASAAS_API_KEY) {
            try {
                const lookupRes = await fetch(
                    `${ASAAS_BASE_URL}/subscriptions?customer=${subscription.asaas_customer_id}&status=ACTIVE`,
                    { method: 'GET', headers: { 'accept': 'application/json', 'access_token': ASAAS_API_KEY } }
                );
                if (lookupRes.ok) {
                    const lookupData = await lookupRes.json();
                    for (const s of (lookupData?.data ?? [])) {
                        if (s?.id) asaasSubIds.push(s.id);
                    }
                    console.log('Recovered Asaas subscriptions by customer for cancel:', asaasSubIds);
                }
            } catch (e) {
                console.error('Error looking up Asaas subscriptions by customer:', e);
            }
        }

        // Cancel subscription(s) in Asaas. Do not mark local cancellation unless Asaas
        // accepted it or reports the subscription no longer exists.
        for (const asaasSubId of asaasSubIds) {
            try {
                const cancelRes = await fetch(
                    `${ASAAS_BASE_URL}/subscriptions/${asaasSubId}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'accept': 'application/json',
                            'access_token': ASAAS_API_KEY
                        }
                    }
                );
                const cancelData = await cancelRes.json();
                console.log('Asaas subscription cancel response:', asaasSubId, cancelRes.status, cancelData);

                if (!cancelRes.ok && cancelRes.status !== 404) {
                    console.error('Failed to cancel Asaas subscription:', cancelData);
                    const errDesc = Array.isArray(cancelData?.errors)
                        ? cancelData.errors.map((e: any) => e.description || e.message).filter(Boolean).join('. ')
                        : cancelData?.error || cancelData?.message;
                    return new Response(
                        JSON.stringify({ error: errDesc || 'Erro ao cancelar assinatura no Asaas.' }),
                        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            } catch (e) {
                console.error('Error cancelling Asaas subscription:', e);
                return new Response(
                    JSON.stringify({ error: 'Erro de comunicação ao cancelar assinatura no Asaas.' }),
                    { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        // Delete all pending or overdue charges explicitly so they disappear
        if (subscription.asaas_customer_id && ASAAS_API_KEY) {
            try {
                // Fetch PENDING and OVERDUE payments explicitly
                let paymentsToDelete: any[] = [];
                for (const status of ['PENDING', 'OVERDUE']) {
                    const payRes = await fetch(
                        `${ASAAS_BASE_URL}/payments?customer=${subscription.asaas_customer_id}&status=${status}`,
                        {
                            method: 'GET',
                            headers: {
                                'accept': 'application/json',
                                'access_token': ASAAS_API_KEY
                            }
                        }
                    );
                    if (payRes.ok) {
                        const payData = await payRes.json();
                        if (payData.data && payData.data.length > 0) {
                            paymentsToDelete = paymentsToDelete.concat(payData.data);
                        }
                    }
                }

                // Delete each pending payment
                for (const pay of paymentsToDelete) {
                    try {
                        const delRes = await fetch(`${ASAAS_BASE_URL}/payments/${pay.id}`, {
                            method: 'DELETE',
                            headers: {
                                'accept': 'application/json',
                                'access_token': ASAAS_API_KEY
                            }
                        });
                        console.log(`Deleted pending payment ${pay.id} on Asaas: ${delRes.status}`);
                    } catch (err) {
                        console.error(`Failed to delete pending payment ${pay.id}:`, err);
                    }
                }
            } catch (e) {
                console.error('Error fetching/deleting pending payments:', e);
            }
        }

        if (isTrial) {
            // Copy user to "desistentes" and delete their account as they are on trial
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('full_name, phone')
                .eq('user_id', user.id)
                .maybeSingle();

            const desistenteData = {
                user_id: user.id,
                email: user.email,
                full_name: profile?.full_name || user.user_metadata?.full_name || '',
                phone: profile?.phone || user.user_metadata?.phone || ''
            };

            const { error: desistenteError } = await supabaseAdmin
                .from('desistentes')
                .insert(desistenteData);

            if (desistenteError) {
                console.error('Error saving desistente:', desistenteError);
                // Non-blocking error
            }

            // Hard delete user from Auth. This cascades and deletes profile, tokens, subscriptions, etc
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

            if (deleteError) {
                console.error('Error deleting user:', deleteError);
                return new Response(
                    JSON.stringify({ error: 'Erro ao excluir conta do usuário.' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            console.log('Trial user deleted successfully:', user.id);

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Período de teste cancelado e dados removidos da plataforma.',
                    cancelledImmediately: true
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        } else {
            // PAID: subscription already deleted on Asaas above; mark cancelled locally
            // (keeps access in UI until current_period_end via is_subscription_inactive logic)
            await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: 'cancelled',
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
                    message: `Sua assinatura foi cancelada. Você ainda terá acesso ao sistema até ${new Date(periodEnd).toLocaleDateString('pt-BR')}.`,
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
