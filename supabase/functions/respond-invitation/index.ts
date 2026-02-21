import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        // Verify user
        const authHeader = req.headers.get('Authorization')!;
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'No authorization header passed' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseClient = createClient(
            supabaseUrl,
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const body = await req.json();
        const { invitationId, action } = body; // action: 'accept' | 'reject'

        if (!invitationId || !['accept', 'reject'].includes(action)) {
            return new Response(
                JSON.stringify({ error: 'Invalid request' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Get invitation
        const { data: invitation, error: inviteError } = await supabaseAdmin
            .from('account_connections')
            .select('*')
            .eq('id', invitationId)
            .single();

        if (inviteError || !invitation) {
            return new Response(
                JSON.stringify({ error: 'Convite não encontrado.' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Verify if the current user is the email recipient
        // (We trust the email match, assuming user owns their email)
        if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
            return new Response(
                JSON.stringify({ error: 'Este convite não é para você.' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (invitation.status !== 'pending') {
            return new Response(
                JSON.stringify({ error: 'Este convite já foi respondido.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const newStatus = action === 'accept' ? 'accepted' : 'rejected';

        // Update invitation
        const { data: updatedInvite, error: updateError } = await supabaseAdmin
            .from('account_connections')
            .update({
                status: newStatus,
                recipient_id: user.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', invitationId)
            .select()
            .single();

        if (updateError) {
            return new Response(
                JSON.stringify({ error: 'Erro ao atualizar convite.' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch requester info for email notification
        let requesterEmail = null;
        let requesterName = 'Usuário';
        if (updatedInvite?.requester_id) {
            const { data: requesterProfile } = await supabaseAdmin
                .from('profiles')
                .select('email, full_name')
                .eq('user_id', updatedInvite.requester_id)
                .maybeSingle();
            if (requesterProfile) {
                requesterEmail = requesterProfile.email;
                requesterName = requesterProfile.full_name || 'Usuário';
            }
        }

        // If accepted, send email to requester
        if (newStatus === 'accepted') {
            const accepterName = user.user_metadata?.full_name || user.email;

            if (requesterEmail) {
                fetch(`${supabaseUrl}/functions/v1/send-payment-email`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        emailType: 'invitation_accepted',
                        to: requesterEmail,
                        userName: requesterName,
                        accepterName: accepterName
                    })
                }).catch(e => console.error('Failed to send accepted email:', e));
            }
        }

        return new Response(
            JSON.stringify({ success: true, invitation: updatedInvite }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in respond-invitation function:', error);
        return new Response(
            JSON.stringify({ error: 'Erro interno no servidor.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
