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
    // With 9 digit - 13 chars
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
      type,
      amount,
      description,
      category,
      date,
      // Novos campos opcionais
      payment_method,     // "debit" | "pix" | "credit" | "boleto" (para expense) / null para income
      bank_account_id,    // UUID do banco (obrigatório se payment_method = debit/pix/boleto)
      credit_card_id,     // UUID do cartão (obrigatório se payment_method = credit)
      total_installments, // Número de parcelas (apenas crédito)
      is_fixed,           // Boolean: indica se é uma despesa/receita fixa
      fixed_months,       // Number (2 a 60): Quantidade de meses para lançar
    } = await req.json();

    // ==================
    // VALIDAÇÕES
    // ==================

    // Campos obrigatórios
    if (!phone || !type || !amount || !category) {
      return new Response(
        JSON.stringify({
          error: 'Campos obrigatórios: phone, type, amount, category',
          campos_obrigatorios: {
            phone: '(string) Telefone do usuário, ex: 5511999999999',
            type: '(string) "income" ou "expense"',
            amount: '(number) Valor da transação, ex: 150.50',
            category: '(string) Categoria, ex: "supermercado", "salario"',
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tipo
    if (type !== 'income' && type !== 'expense') {
      return new Response(
        JSON.stringify({
          error: 'Tipo inválido. Use "income" (receita) ou "expense" (despesa)',
          valores_aceitos: ['income', 'expense']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valor (amount) deve ser um número positivo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Payment method validation para despesas
    const validPaymentMethods = ['debit', 'pix', 'credit', 'boleto'];
    if (type === 'expense' && payment_method && !validPaymentMethods.includes(payment_method)) {
      return new Response(
        JSON.stringify({
          error: `Método de pagamento inválido: "${payment_method}"`,
          valores_aceitos: validPaymentMethods,
          dica: 'Para despesas, informe: debit, pix, credit ou boleto'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================
    // BUSCAR USUÁRIO
    // ==================
    const userId = await getUserIdByPhone(supabase, phone);

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: 'Usuário não encontrado com esse número de telefone',
          phone,
          dica: 'Verifique se o número está correto. Formato: 5511999999999'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================
    // VALIDAR BANCO/CARTÃO
    // ==================
    let resolvedBankAccountId = bank_account_id || null;
    let resolvedCreditCardId = credit_card_id || null;

    // Para despesas com método de pagamento que requer banco
    if (type === 'expense' && payment_method && ['debit', 'pix', 'boleto'].includes(payment_method)) {
      if (!bank_account_id) {
        // Tentar buscar banco padrão (primeiro banco cadastrado)
        const { data: banks } = await supabase
          .from('bank_accounts')
          .select('id, name')
          .eq('user_id', userId)
          .order('name')
          .limit(1);

        if (!banks || banks.length === 0) {
          return new Response(
            JSON.stringify({
              error: `Para pagamento via ${payment_method.toUpperCase()}, é necessário ter uma conta bancária cadastrada`,
              dica: 'O usuário precisa cadastrar pelo menos um banco no app (menu Bancos e Cartões)',
              code: 'NO_BANK_ACCOUNT'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        resolvedBankAccountId = banks[0].id;
      } else {
        // Validar que o banco pertence ao usuário
        const { data: bank } = await supabase
          .from('bank_accounts')
          .select('id, name')
          .eq('id', bank_account_id)
          .eq('user_id', userId)
          .single();

        if (!bank) {
          return new Response(
            JSON.stringify({
              error: 'Conta bancária não encontrada ou não pertence ao usuário',
              bank_account_id,
              code: 'INVALID_BANK_ACCOUNT'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Para receitas, banco de destino
    if (type === 'income') {
      if (bank_account_id) {
        const { data: bank } = await supabase
          .from('bank_accounts')
          .select('id, name')
          .eq('id', bank_account_id)
          .eq('user_id', userId)
          .single();

        if (!bank) {
          return new Response(
            JSON.stringify({
              error: 'Conta bancária de destino não encontrada ou não pertence ao usuário',
              bank_account_id,
              code: 'INVALID_BANK_ACCOUNT'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        resolvedBankAccountId = bank.id;
      } else {
        // Tentar banco padrão
        const { data: banks } = await supabase
          .from('bank_accounts')
          .select('id, name')
          .eq('user_id', userId)
          .order('name')
          .limit(1);

        if (banks && banks.length > 0) {
          resolvedBankAccountId = banks[0].id;
        }
      }
    }

    // Para crédito
    if (type === 'expense' && payment_method === 'credit') {
      if (!credit_card_id) {
        const { data: cards } = await supabase
          .from('credit_cards')
          .select('id, name')
          .eq('user_id', userId)
          .order('name')
          .limit(1);

        if (!cards || cards.length === 0) {
          return new Response(
            JSON.stringify({
              error: 'Para pagamento via crédito, é necessário ter um cartão de crédito cadastrado',
              dica: 'O usuário precisa cadastrar pelo menos um cartão no app (menu Bancos e Cartões)',
              code: 'NO_CREDIT_CARD'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        resolvedCreditCardId = cards[0].id;
      } else {
        const { data: card } = await supabase
          .from('credit_cards')
          .select('id, name')
          .eq('id', credit_card_id)
          .eq('user_id', userId)
          .single();

        if (!card) {
          return new Response(
            JSON.stringify({
              error: 'Cartão de crédito não encontrado ou não pertence ao usuário',
              credit_card_id,
              code: 'INVALID_CREDIT_CARD'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // ==================
    // INSERIR TRANSAÇÃO (Única ou Recorrente/Fixa)
    // ==================
    let transactionsToInsert: any[] = [];
    const baseDate = date || new Date().toISOString().split('T')[0];
    const groupId = crypto.randomUUID();

    if (is_fixed && fixed_months && fixed_months > 1) {
      // Cria múltiplas transações para os meses futuros
      const totalMonths = Math.min(parseInt(fixed_months), 60); // Limite máximo 60 meses

      for (let i = 0; i < totalMonths; i++) {
        // Incrementa o mês adequadamente
        const fixedDateObj = new Date(baseDate);
        fixedDateObj.setMonth(fixedDateObj.getMonth() + i);
        const dateStr = fixedDateObj.toISOString().split('T')[0];

        const suffix = i > 0 ? ` (Fixa ${i + 1}/${totalMonths})` : "";
        let desc = description ? `${description}${suffix}` : suffix.trim();

        const insertRow: any = {
          type,
          amount: parsedAmount,
          description: desc || null,
          category,
          date: dateStr,
          transaction_date: dateStr,
          user_id: userId,
          installment_group_id: groupId,
          total_installments: 1,
          installment_number: 1,
        };

        if (payment_method) insertRow.payment_method = payment_method;
        if (resolvedBankAccountId) insertRow.bank_account_id = resolvedBankAccountId;
        if (resolvedCreditCardId) insertRow.credit_card_id = resolvedCreditCardId;

        transactionsToInsert.push(insertRow);
      }
    } else if (total_installments && payment_method === 'credit' && parseInt(total_installments) > 1) {
      // Cria múltiplas transações de parcelamento (Crédito)
      const numInstallments = parseInt(total_installments);
      const installmentAmount = Math.round((parsedAmount / numInstallments) * 100) / 100;

      for (let i = 0; i < numInstallments; i++) {
        const installmentDate = new Date(baseDate + 'T12:00:00');
        installmentDate.setMonth(installmentDate.getMonth() + i);
        const dateStr = `${installmentDate.getFullYear()}-${String(installmentDate.getMonth() + 1).padStart(2, '0')}-${String(installmentDate.getDate()).padStart(2, '0')}`;

        // Ajustar centavos na última parcela para evitar dizimas não exatas
        let currentAmount = installmentAmount;
        if (i === numInstallments - 1) {
          currentAmount = Math.round((parsedAmount - (installmentAmount * (numInstallments - 1))) * 100) / 100;
        }

        const insertRow: any = {
          type,
          amount: currentAmount,
          description: description || null,
          category,
          date: dateStr,
          transaction_date: dateStr,
          user_id: userId,
          payment_method: 'credit',
          credit_card_id: resolvedCreditCardId,
          total_installments: numInstallments,
          installment_number: i + 1,
          installment_group_id: groupId,
        };

        transactionsToInsert.push(insertRow);
      }
    } else {
      // Transação única normal
      const insertRow: any = {
        type,
        amount: parsedAmount,
        description: description || null,
        category,
        date: baseDate,
        transaction_date: baseDate,
        user_id: userId,
      };

      if (payment_method) insertRow.payment_method = payment_method;
      if (resolvedBankAccountId) insertRow.bank_account_id = resolvedBankAccountId;
      if (resolvedCreditCardId) insertRow.credit_card_id = resolvedCreditCardId;
      if (total_installments && payment_method === 'credit') {
        insertRow.total_installments = 1;
        insertRow.installment_number = 1;
      }

      transactionsToInsert.push(insertRow);
    }

    const { data: transactionData, error: transactionError } = await supabase
      .from('transactions')
      .insert(transactionsToInsert)
      .select();

    if (transactionError) {
      console.error('Erro ao inserir transação:', transactionError);
      return new Response(
        JSON.stringify({
          error: 'Erro ao criar transação/transações fixas',
          details: transactionError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pega os IDs retornados no array para montar o link
    const createdIds = transactionData?.map((t: { id: string }) => t.id) || [];
    const returnData = transactionsToInsert.length === 1 ? transactionData![0] : transactionData;

    let budgetAlert = undefined;

    if (type === 'expense') {
      const d = baseDate ? new Date(baseDate) : new Date();
      // Resolve Fuso e pega o Mês base extraindo da data raw 'YYYY-MM-DD' caso disponível
      const currentMonthYear = baseDate ? baseDate.substring(0, 7) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('amount')
        .eq('user_id', userId)
        .eq('category', category)
        .eq('month_year', currentMonthYear)
        .maybeSingle();
        
      if (budgetData) {
        const { data: expenses } = await supabase
           .from('transactions')
           .select('amount')
           .eq('user_id', userId)
           .eq('type', 'expense')
           .eq('category', category)
           .gte('date', `${currentMonthYear}-01`)
           .lte('date', `${currentMonthYear}-31`);
           
        const totalSpent = (expenses || []).reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
        const limit = Number(budgetData.amount);
        const perc = limit > 0 ? (totalSpent / limit) * 100 : 100;
        
        let status = "ok";
        let msg = `Tudo sob controle, utilizou ${perc.toFixed(0)}% do orçamento de ${category}.`;
        if (perc >= 100) {
            status = "danger";
            msg = `🚨 ESTOUROU! ${perc.toFixed(0)}% utilizado em ${category} (R$ ${totalSpent.toFixed(2)} de R$ ${limit.toFixed(2)}).`;
        } else if (perc >= 90) {
            status = "warning";
            msg = `⚠️ Atenção! Você gastou ${perc.toFixed(0)}% do seu teto de ${category}.`;
        }
        
        budgetAlert = { status, percentage: parseFloat(perc.toFixed(1)), message: msg, limit, total_spent: totalSpent };
      }
    }

    return new Response(
      JSON.stringify({
        message: transactionsToInsert.length > 1 ? `Criadas ${transactionsToInsert.length} transações fixas com sucesso!` : 'Transação criada com sucesso!',
        transaction_id: createdIds.length === 1 ? createdIds[0] : undefined,
        transaction_ids: createdIds.length > 1 ? createdIds : undefined,
        budget_alert: budgetAlert,
        transaction_url: `https://dlbiwguzbiosaoyrcvay.supabase.co/rest/v1/transactions?id=in.(${createdIds.join(',')})`,
        data: returnData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});