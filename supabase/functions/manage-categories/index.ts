import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// Helper: normalizar telefone e buscar user_id
// ============================================
async function getUserIdByPhone(supabase: any, phone: string): Promise<string | null> {
  const normalizedPhone = phone.replace(/\D/g, '');

  const variations = [
    normalizedPhone,
    `+${normalizedPhone}`,
    normalizedPhone.length > 10 ? normalizedPhone.substring(2) : normalizedPhone,
    normalizedPhone.length === 12 && normalizedPhone.startsWith('55') ?
      `55${normalizedPhone.substring(2, 4)}9${normalizedPhone.substring(4)}` : null,
    normalizedPhone.length === 12 && normalizedPhone.startsWith('55') ?
      `+55${normalizedPhone.substring(2, 4)}9${normalizedPhone.substring(4)}` : null,
    normalizedPhone.length === 12 && normalizedPhone.startsWith('55') ?
      `${normalizedPhone.substring(4)}` : null,
    normalizedPhone.length === 13 && normalizedPhone.startsWith('55') ?
      normalizedPhone.substring(2) : null,
    normalizedPhone.length === 13 && normalizedPhone.startsWith('55') ?
      `+${normalizedPhone}` : null,
  ].filter(Boolean);

  for (const phoneVariation of variations) {
    const { data, error } = await supabase
      .rpc('get_user_id_by_phone', { phone_number: phoneVariation });

    if (!error && data) {
      return data as string;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      phone,
      action, // create_category, create_subcategory, edit_category
      name, // Nome da nova categoria ou subcategoria
      type, // 'income' ou 'expense'
      parent_name, // Necessário p/ criar subcategoria (Pai)
      old_name, // Necessário p/ editar (Nome original)
      new_name, // Necessário p/ editar (Novo nome)
    } = await req.json();

    if (!phone || !action) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: phone, action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = await getUserIdByPhone(supabase, phone);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado com esse número de telefone' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Funcões uteis p sanitização
    const createSlug = (text: string) => {
      return text.toLowerCase()
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_|_$)/g, '');
    };

    if (action === 'create_category') {
      if (!name || (type !== 'income' && type !== 'expense')) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatórios: name, type (income|expense)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const slug = createSlug(name);

      // Check duplicidade
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .eq('value', slug)
        .eq('type', type)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: 'Categoria já existe.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: name.trim(),
          value: slug,
          type: type,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'create_subcategory') {
      if (!name || !parent_name || (type !== 'income' && type !== 'expense')) {
        return new Response(
          JSON.stringify({ error: 'Campos req: name, parent_name, type (income|expense)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const parentSlug = createSlug(parent_name);
      const childSlug = createSlug(name);

      // Find parent category
      const { data: parent } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .eq('type', type)
        .or(`value.eq.${parentSlug},name.ilike.${parent_name}`)
        .maybeSingle();

      if (!parent) {
        return new Response(
          JSON.stringify({ error: 'Categoria Pai não encontrada.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create child
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: name.trim(),
          value: childSlug,
          type: type,
          parent_id: parent.id
        } as any)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'edit_category') {
      if (!old_name || !new_name || (type !== 'income' && type !== 'expense')) {
        return new Response(
          JSON.stringify({ error: 'Campos req: old_name, new_name, type (income|expense)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const targetSlug = createSlug(old_name);
      const newSlug = createSlug(new_name);

      const { data: target } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .eq('type', type)
        .or(`value.eq.${targetSlug},name.ilike.${old_name}`)
        .maybeSingle();

      if (!target) {
        return new Response(
          JSON.stringify({ error: 'Categoria alvo não encontrada.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: any = {
        name: new_name.trim(),
        value: newSlug
      };

      if (parent_name) {
        const parentSlugParam = createSlug(parent_name);
        const { data: parent } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', userId)
          .eq('type', type)
          .or(`value.eq.${parentSlugParam},name.ilike.${parent_name}`)
          .maybeSingle();

        if (parent) {
          updateData.parent_id = parent.id;
        }
      }

      const { data, error } = await supabase
        .from('categories')
        .update(updateData)
        .eq('id', target.id)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ error: 'Ação (action) desconhecida ou inválida.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
