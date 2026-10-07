// Desativada: qualquer pessoa conseguia atribuir super_admin a qualquer user_id.
// Papeis de novos usuarios sao definidos pelo trigger handle_new_user.
Deno.serve(() =>
  new Response(JSON.stringify({ error: 'gone' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  })
);
