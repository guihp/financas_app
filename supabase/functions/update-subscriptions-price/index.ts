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
        // Verify admin authorization
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Authorization header required' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const token = authHeader.replace('Bearer ', '');
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Verify user is super_admin
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { data: roleData } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();

        if (!roleData || (roleData.role !== 'super_admin' && roleData.role !== 'admin')) {
            return new Response(
                JSON.stringify({ error: 'Apenas super admins podem atualizar assinaturas.' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get current pricing from app_settings
        const { data: appSettings } = await supabaseAdmin
            .from('app_settings')
            .select('*')
            .limit(1)
            .single();

        if (!appSettings || !appSettings.product_full_price) {
            return new Response(
                JSON.stringify({ error: 'Configurações de preço não encontradas.' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const newPrice = Number(appSettings.product_full_price);
        console.log(`Updating all active subscriptions to new price: R$${newPrice}`);

        // Get all active subscriptions from the subscriptions table
        const { data: subscriptions, error: subError } = await supabaseAdmin
            .from('subscriptions')
            .select('asaas_subscription_id, user_id')
            .not('asaas_subscription_id', 'is', null);

        if (subError) {
            console.error('Error fetching subscriptions:', subError);
            return new Response(
                JSON.stringify({ error: 'Erro ao buscar assinaturas.' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Also check pending_registrations for subscription IDs
        const { data: pendingRegs } = await supabaseAdmin
            .from('pending_registrations')
            .select('asaas_subscription_id')
            .not('asaas_subscription_id', 'is', null);

        // Collect all unique subscription IDs
        const allSubIds = new Set<string>();
        (subscriptions || []).forEach((s: any) => {
            if (s.asaas_subscription_id) allSubIds.add(s.asaas_subscription_id);
        });
        (pendingRegs || []).forEach((r: any) => {
            if (r.asaas_subscription_id) allSubIds.add(r.asaas_subscription_id);
        });

        console.log(`Found ${allSubIds.size} subscription(s) to update`);

        const results: { id: string; status: string; error?: string }[] = [];

        for (const subId of allSubIds) {
            try {
                // First, get the current subscription from Asaas to check its value
                const getRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subId}`, {
                    headers: { 'accept': 'application/json', 'access_token': ASAAS_API_KEY }
                });
                const subData = await getRes.json();

                if (!getRes.ok || subData.errors) {
                    results.push({ id: subId, status: 'error', error: 'Assinatura não encontrada no Asaas' });
                    continue;
                }

                // Skip if already at the correct price
                if (Number(subData.value) === newPrice) {
                    results.push({ id: subId, status: 'already_correct' });
                    continue;
                }

                // Skip inactive subscriptions
                if (subData.status === 'INACTIVE' || subData.status === 'EXPIRED') {
                    results.push({ id: subId, status: 'skipped_inactive' });
                    continue;
                }

                // Update subscription value
                const updateRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subId}`, {
                    method: 'PUT',
                    headers: {
                        'accept': 'application/json',
                        'content-type': 'application/json',
                        'access_token': ASAAS_API_KEY
                    },
                    body: JSON.stringify({
                        value: newPrice,
                        updatePendingPayments: true
                    })
                });

                const updateData = await updateRes.json();

                if (updateRes.ok && !updateData.errors) {
                    results.push({ id: subId, status: 'updated' });
                    console.log(`Updated subscription ${subId} from R$${subData.value} to R$${newPrice}`);
                } else {
                    const errMsg = updateData.errors?.[0]?.description || 'Erro desconhecido';
                    results.push({ id: subId, status: 'error', error: errMsg });
                    console.error(`Failed to update ${subId}:`, updateData);
                }
            } catch (err: any) {
                results.push({ id: subId, status: 'error', error: err.message });
                console.error(`Error updating subscription ${subId}:`, err);
            }
        }

        const updated = results.filter(r => r.status === 'updated').length;
        const alreadyCorrect = results.filter(r => r.status === 'already_correct').length;
        const errors = results.filter(r => r.status === 'error').length;
        const skipped = results.filter(r => r.status === 'skipped_inactive').length;

        return new Response(
            JSON.stringify({
                success: true,
                newPrice,
                total: allSubIds.size,
                updated,
                alreadyCorrect,
                skipped,
                errors,
                details: results
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Error in update-subscriptions-price:', error);
        return new Response(
            JSON.stringify({ error: 'Erro interno. Tente novamente.', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
