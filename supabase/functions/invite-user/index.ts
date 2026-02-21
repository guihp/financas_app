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

        // Create a Supabase client with the Auth context of the logged in user
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

        // Get the user from the token
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: userError }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const requesterId = user.id;
        const body = await req.json();
        const { email } = body;

        if (!email) {
            return new Response(
                JSON.stringify({ error: 'Email is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const inviteeEmail = email.toLowerCase().trim();

        // Prevent inviting yourself
        if (inviteeEmail === user.email?.toLowerCase()) {
            return new Response(
                JSON.stringify({ error: 'Você não pode convidar a si mesmo.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Use admin client for database operations that require extended privileges
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Check if connection already exists
        const { data: existingConnection, error: checkError } = await supabaseAdmin
            .from('account_connections')
            .select('*')
            .or(`requester_id.eq.${requesterId},recipient_id.eq.${requesterId}`)
            .eq('email', inviteeEmail)
            .in('status', ['pending', 'accepted'])
            .maybeSingle();

        if (existingConnection) {
            return new Response(
                JSON.stringify({ error: 'Já existe um convite ou conexão com este e-mail.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check if invitee exists by looking up their profile
        let recipientId = null;

        // First, try to find the user by email in profiles table
        const { data: profileData } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('email', inviteeEmail)
            .maybeSingle();

        if (profileData) {
            recipientId = profileData.user_id;
        } else {
            // Fallback: check auth.users via admin API with email filter
            const { data: usersByEmail } = await supabaseAdmin.auth.admin.listUsers({
                filter: `email.eq.${inviteeEmail}`,
                page: 1,
                perPage: 1
            });

            const foundUser = usersByEmail?.users?.find(u => u.email?.toLowerCase() === inviteeEmail);
            if (foundUser) {
                // Check if profile exists to avoid FK violation
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('user_id')
                    .eq('user_id', foundUser.id)
                    .maybeSingle();

                if (profile) {
                    recipientId = foundUser.id;
                }
            }
        }

        // Create connection record
        const { data: connection, error: createError } = await supabaseAdmin
            .from('account_connections')
            .insert({
                requester_id: requesterId,
                email: inviteeEmail,
                recipient_id: recipientId,
                status: 'pending'
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating connection:', createError);
            return new Response(
                JSON.stringify({ error: 'Erro ao criar convite.' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Send invitation email
        // Get requester name from metadata or profiles
        let requesterName = user.user_metadata?.full_name || user.email;

        // Get invitee name if they have a profile
        let inviteeName = undefined;
        if (recipientId) {
            const { data: recipientProfile } = await supabaseAdmin
                .from('profiles')
                .select('full_name')
                .eq('user_id', recipientId)
                .maybeSingle();
            inviteeName = recipientProfile?.full_name;
        }

        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-payment-email`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                emailType: 'invitation',
                to: inviteeEmail,
                userName: inviteeName,
                requesterName: requesterName,
                invitationLink: `https://app.iafeoficial.com/convite?id=${connection.id}`
            })
        });

        if (!emailRes.ok) {
            console.error('Failed to send invitation email');
            // We don't fail the request, but we log it.
        }

        return new Response(
            JSON.stringify({ success: true, connection }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in invite-user function:', error);
        return new Response(
            JSON.stringify({ error: 'Erro interno no servidor.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
