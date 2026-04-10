import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

/** Resposta bruta da Edge Function (sucesso ou erro HTTP). */
async function callEdgeJson(
  slug: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    query?: Record<string, string | undefined>;
    body?: Record<string, unknown>;
  },
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const { data: { session } } = await supabase.auth.getSession();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const token = session?.access_token ?? anon;

  let url = `${supabase.supabaseUrl}/functions/v1/${slug}`;
  if (options.query) {
    const u = new URL(url);
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== "") u.searchParams.set(k, v);
    }
    url = u.toString();
  }

  const method = options.method ?? (options.body ? "POST" : "GET");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    apikey: anon,
  };

  const res = await fetch(url, {
    method,
    headers:
      options.body && method !== "GET"
        ? { ...headers, "Content-Type": "application/json" }
        : headers,
    body: options.body && method !== "GET" ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function formatResult(r: { ok: boolean; status: number; data: unknown }): string {
  return JSON.stringify({ httpStatus: r.status, ok: r.ok, body: r.data }, null, 2);
}

export const ApiTestForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  const run = useCallback(
    async (fn: () => Promise<{ ok: boolean; status: number; data: unknown }>, okTitle: string) => {
      setLoading(true);
      setResult("");
      try {
        const r = await fn();
        setResult(formatResult(r));
        if (r.ok) {
          toast({ title: okTitle, description: `HTTP ${r.status}` });
        } else {
          const errMsg =
            typeof r.data === "object" && r.data !== null && "error" in r.data
              ? String((r.data as { error?: unknown }).error)
              : `HTTP ${r.status}`;
          toast({
            title: "Erro na função",
            description: errMsg.slice(0, 200),
            variant: "destructive",
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setResult(JSON.stringify({ error: msg }, null, 2));
        toast({ title: "Falha na requisição", description: msg, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  // —— Estado por área (campos compartilhados onde faz sentido)
  const [phone, setPhone] = useState("");
  const [getCatType, setGetCatType] = useState<string>("");
  const [txBank, setTxBank] = useState("");

  const [addTx, setAddTx] = useState({
    type: "expense",
    amount: "",
    description: "",
    category: "",
    date: "",
    payment_method: "debit",
    bank_account_id: "",
    credit_card_id: "",
    total_installments: "",
  });

  const [updTx, setUpdTx] = useState({
    transaction_id: "",
    amount: "",
    description: "",
    category: "",
    date: "",
  });

  const [cancelTxId, setCancelTxId] = useState("");

  const [mcAction, setMcAction] = useState("create_category");
  const [mcName, setMcName] = useState("");
  const [mcType, setMcType] = useState("expense");
  const [mcParent, setMcParent] = useState("");
  const [mcOldName, setMcOldName] = useState("");
  const [mcNewName, setMcNewName] = useState("");

  const [shopAction, setShopAction] = useState("list_lists");
  const [shopJson, setShopJson] = useState("{}");

  const [budAction, setBudAction] = useState("list");
  const [budJson, setBudJson] = useState("{}");

  const [apTitle, setApTitle] = useState("");
  const [apDesc, setApDesc] = useState("");
  const [apDate, setApDate] = useState("");
  const [apTime, setApTime] = useState("");
  const [apId, setApId] = useState("");
  const [apUpdTitle, setApUpdTitle] = useState("");
  const [apStatus, setApStatus] = useState("");

  return (
    <div className="space-y-4 w-full">
      <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400">
        <p>
          Usa a sessão do app quando você está logado (JWT). Fora da sessão, usa a chave anônima — funções com{" "}
          <code className="text-slate-300">verify_jwt</code> podem falhar sem login.
        </p>
      </div>

      <Tabs defaultValue="user" className="w-full">
        <ScrollArea className="w-full pb-2">
          <TabsList className="inline-flex h-auto min-h-10 w-max flex-wrap gap-1 bg-slate-900 p-1">
            <TabsTrigger value="user" className="text-xs shrink-0">
              Usuário / categorias
            </TabsTrigger>
            <TabsTrigger value="tx" className="text-xs shrink-0">
              Transações
            </TabsTrigger>
            <TabsTrigger value="accounts" className="text-xs shrink-0">
              Contas
            </TabsTrigger>
            <TabsTrigger value="categories" className="text-xs shrink-0">
              Categorias (usuário)
            </TabsTrigger>
            <TabsTrigger value="shopping" className="text-xs shrink-0">
              Lista / orçamento
            </TabsTrigger>
            <TabsTrigger value="appointments" className="text-xs shrink-0">
              Agendamentos
            </TabsTrigger>
          </TabsList>
        </ScrollArea>

        {/* —— Usuário —— */}
        <TabsContent value="user" className="space-y-4 mt-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="5511999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={loading || !phone.trim()}
              variant="secondary"
              onClick={() =>
                run(
                  () =>
                    callEdgeJson("get-user-by-phone", {
                      method: "GET",
                      query: { phone: phone.trim() },
                    }),
                  "Perfil carregado",
                )
              }
            >
              GET get-user-by-phone
            </Button>
            <Button
              type="button"
              disabled={loading}
              variant="secondary"
              onClick={() =>
                run(
                  () =>
                    callEdgeJson("get-categories", {
                      method: "GET",
                      query: {
                        type: getCatType || undefined,
                      },
                    }),
                  "Categorias globais",
                )
              }
            >
              GET get-categories
            </Button>
          </div>
          <div className="max-w-xs space-y-2">
            <Label className="text-xs text-slate-500">Filtro type (opcional)</Label>
            <Select value={getCatType || "__all"} onValueChange={(v) => setGetCatType(v === "__all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                <SelectItem value="income">income</SelectItem>
                <SelectItem value="expense">expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* —— Transações —— */}
        <TabsContent value="tx" className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Telefone (todas as ações abaixo)</Label>
            <Input placeholder="5511999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="rounded-lg border border-slate-800 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-200">Extrato — GET get-transactions-by-phone</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Filtro banco (nome ou UUID, opcional)</Label>
                <Input value={txBank} onChange={(e) => setTxBank(e.target.value)} placeholder="Nubank ou UUID" />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={loading || !phone.trim()}
              variant="secondary"
              onClick={() =>
                run(
                  () =>
                    callEdgeJson("get-transactions-by-phone", {
                      method: "GET",
                      query: { phone: phone.trim(), bank: txBank.trim() || undefined },
                    }),
                  "Extrato obtido",
                )
              }
            >
              Buscar transações do mês
            </Button>
          </div>

          <div className="rounded-lg border border-slate-800 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-200">POST add-transaction-by-phone</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Tipo</Label>
                <Select value={addTx.type} onValueChange={(v) => setAddTx({ ...addTx, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={addTx.amount}
                  onChange={(e) => setAddTx({ ...addTx, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">Descrição (opcional)</Label>
                <Textarea
                  rows={2}
                  value={addTx.description}
                  onChange={(e) => setAddTx({ ...addTx, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Categoria (slug)</Label>
                <Input
                  value={addTx.category}
                  onChange={(e) => setAddTx({ ...addTx, category: e.target.value })}
                  placeholder="supermercado"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Data (YYYY-MM-DD)</Label>
                <Input
                  type="date"
                  value={addTx.date}
                  onChange={(e) => setAddTx({ ...addTx, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">payment_method (despesa)</Label>
                <Select
                  value={addTx.payment_method}
                  onValueChange={(v) => setAddTx({ ...addTx, payment_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">debit</SelectItem>
                    <SelectItem value="pix">pix</SelectItem>
                    <SelectItem value="credit">credit</SelectItem>
                    <SelectItem value="boleto">boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">bank_account_id (opcional)</Label>
                <Input
                  value={addTx.bank_account_id}
                  onChange={(e) => setAddTx({ ...addTx, bank_account_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">credit_card_id (opcional)</Label>
                <Input
                  value={addTx.credit_card_id}
                  onChange={(e) => setAddTx({ ...addTx, credit_card_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Parcelas (crédito, opcional)</Label>
                <Input
                  value={addTx.total_installments}
                  onChange={(e) => setAddTx({ ...addTx, total_installments: e.target.value })}
                  placeholder="ex: 3"
                />
              </div>
            </div>
            <Button
              type="button"
              disabled={loading || !phone.trim() || !addTx.category || !addTx.amount}
              onClick={() => {
                const body: Record<string, unknown> = {
                  phone: phone.trim(),
                  type: addTx.type,
                  amount: parseFloat(addTx.amount),
                  category: addTx.category,
                };
                if (addTx.description.trim()) body.description = addTx.description.trim();
                if (addTx.date) body.date = addTx.date;
                if (addTx.type === "expense" && addTx.payment_method) {
                  body.payment_method = addTx.payment_method;
                }
                if (addTx.bank_account_id.trim()) body.bank_account_id = addTx.bank_account_id.trim();
                if (addTx.credit_card_id.trim()) body.credit_card_id = addTx.credit_card_id.trim();
                if (addTx.total_installments.trim()) {
                  body.total_installments = parseInt(addTx.total_installments, 10);
                }
                return run(() => callEdgeJson("add-transaction-by-phone", { body }), "Transação enviada");
              }}
            >
              Adicionar transação
            </Button>
          </div>

          <div className="rounded-lg border border-slate-800 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-200">PUT update-transaction-by-phone</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">transaction_id</Label>
                <Input value={updTx.transaction_id} onChange={(e) => setUpdTx({ ...updTx, transaction_id: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Novo valor (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={updTx.amount}
                  onChange={(e) => setUpdTx({ ...updTx, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Nova data (opcional)</Label>
                <Input type="date" value={updTx.date} onChange={(e) => setUpdTx({ ...updTx, date: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">Descrição (opcional)</Label>
                <Input value={updTx.description} onChange={(e) => setUpdTx({ ...updTx, description: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">Categoria (opcional)</Label>
                <Input value={updTx.category} onChange={(e) => setUpdTx({ ...updTx, category: e.target.value })} />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || !phone.trim() || !updTx.transaction_id.trim()}
              onClick={() => {
                const body: Record<string, unknown> = {
                  phone: phone.trim(),
                  transaction_id: updTx.transaction_id.trim(),
                };
                if (updTx.amount) body.amount = parseFloat(updTx.amount);
                if (updTx.description.trim()) body.description = updTx.description.trim();
                if (updTx.category.trim()) body.category = updTx.category.trim();
                if (updTx.date) body.date = updTx.date;
                return run(() => callEdgeJson("update-transaction-by-phone", { method: "PUT", body }), "Transação atualizada");
              }}
            >
              Atualizar transação
            </Button>
          </div>

          <div className="rounded-lg border border-slate-800 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-200">POST cancel-transaction-by-phone</p>
            <div className="space-y-2 max-w-md">
              <Label className="text-xs">transaction_id</Label>
              <Input value={cancelTxId} onChange={(e) => setCancelTxId(e.target.value)} />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={loading || !phone.trim() || !cancelTxId.trim()}
              onClick={() =>
                run(
                  () =>
                    callEdgeJson("cancel-transaction-by-phone", {
                      body: { phone: phone.trim(), transaction_id: cancelTxId.trim() },
                    }),
                  "Transação cancelada",
                )
              }
            >
              Cancelar / excluir transação
            </Button>
          </div>
        </TabsContent>

        {/* —— Contas —— */}
        <TabsContent value="accounts" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input placeholder="5511999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <p className="text-xs text-slate-500">
            Lista bancos e cartões. Para criar banco/cartão, pagar fatura etc., use o JSON no corpo conforme a documentação (POST manage-accounts-by-phone).
          </p>
          <Button
            type="button"
            disabled={loading || !phone.trim()}
            variant="secondary"
            onClick={() =>
              run(
                () =>
                  callEdgeJson("manage-accounts-by-phone", {
                    method: "GET",
                    query: { phone: phone.trim() },
                  }),
                "Contas listadas",
              )
            }
          >
            GET manage-accounts-by-phone
          </Button>
        </TabsContent>

        {/* —— Categorias do usuário —— */}
        <TabsContent value="categories" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input placeholder="5511999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">action</Label>
              <Select value={mcAction} onValueChange={setMcAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create_category">create_category</SelectItem>
                  <SelectItem value="create_subcategory">create_subcategory</SelectItem>
                  <SelectItem value="edit_category">edit_category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">type</Label>
              <Select value={mcType} onValueChange={(v) => setMcType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">expense</SelectItem>
                  <SelectItem value="income">income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(mcAction === "create_category" || mcAction === "create_subcategory") && (
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">name</Label>
                <Input value={mcName} onChange={(e) => setMcName(e.target.value)} />
              </div>
            )}
            {mcAction === "create_subcategory" && (
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">parent_name</Label>
                <Input value={mcParent} onChange={(e) => setMcParent(e.target.value)} />
              </div>
            )}
            {mcAction === "edit_category" && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">old_name</Label>
                  <Input value={mcOldName} onChange={(e) => setMcOldName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">new_name</Label>
                  <Input value={mcNewName} onChange={(e) => setMcNewName(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs">parent_name (opcional, para mover)</Label>
                  <Input value={mcParent} onChange={(e) => setMcParent(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <Button
            type="button"
            disabled={
              loading ||
              !phone.trim() ||
              (mcAction === "create_category" && !mcName.trim()) ||
              (mcAction === "create_subcategory" &&
                (!mcName.trim() || !mcParent.trim())) ||
              (mcAction === "edit_category" && (!mcOldName.trim() || !mcNewName.trim()))
            }
            onClick={() => {
              const body: Record<string, unknown> = {
                phone: phone.trim(),
                action: mcAction,
                type: mcType,
              };
              if (mcAction === "create_category") {
                body.name = mcName.trim();
              } else if (mcAction === "create_subcategory") {
                body.name = mcName.trim();
                body.parent_name = mcParent.trim();
              } else {
                body.old_name = mcOldName.trim();
                body.new_name = mcNewName.trim();
                if (mcParent.trim()) body.parent_name = mcParent.trim();
              }
              return run(() => callEdgeJson("manage-categories", { body }), "Categoria enviada");
            }}
          >
            POST manage-categories
          </Button>
        </TabsContent>

        {/* —— Lista + orçamento —— */}
        <TabsContent value="shopping" className="space-y-6 mt-4">
          <div className="rounded-lg border border-amber-900/30 bg-amber-950/20 p-3 text-xs text-amber-200/90">
            Exige JWT válido (<code className="text-amber-100">verify_jwt: true</code>). Faça login no app antes de testar.
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Telefone (incluído no JSON se faltar)</Label>
            <Input placeholder="5511999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">shopping-by-phone — mesclar phone com JSON abaixo</Label>
            <Select value={shopAction} onValueChange={setShopAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list_lists">list_lists</SelectItem>
                <SelectItem value="create_list">create_list</SelectItem>
                <SelectItem value="get_list">get_list</SelectItem>
                <SelectItem value="add_item">add_item</SelectItem>
                <SelectItem value="update_item">update_item</SelectItem>
                <SelectItem value="delete_item">delete_item</SelectItem>
                <SelectItem value="delete_list">delete_list</SelectItem>
                <SelectItem value="finalize_list">finalize_list</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              className="font-mono text-xs min-h-[120px]"
              value={shopJson}
              onChange={(e) => setShopJson(e.target.value)}
              placeholder='{"list_id":"…","name":"…"}'
            />
            <Button
              type="button"
              disabled={loading}
              onClick={() => {
                let parsed: Record<string, unknown>;
                try {
                  parsed = JSON.parse(shopJson || "{}");
                } catch {
                  toast({ title: "JSON inválido", variant: "destructive" });
                  return Promise.resolve();
                }
                const body = { ...parsed, action: shopAction, phone: (parsed.phone as string) || phone.trim() };
                if (!body.phone) {
                  toast({ title: "Informe telefone", variant: "destructive" });
                  return Promise.resolve();
                }
                return run(() => callEdgeJson("shopping-by-phone", { body }), "shopping-by-phone");
              }}
            >
              POST shopping-by-phone
            </Button>
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-4">
            <Label className="text-xs">budgets-by-phone</Label>
            <Select value={budAction} onValueChange={setBudAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">list</SelectItem>
                <SelectItem value="upsert">upsert</SelectItem>
                <SelectItem value="delete">delete</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              className="font-mono text-xs min-h-[100px]"
              value={budJson}
              onChange={(e) => setBudJson(e.target.value)}
              placeholder='{"month_year":"2026-04","category":"supermercado","amount":800}'
            />
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => {
                let parsed: Record<string, unknown>;
                try {
                  parsed = JSON.parse(budJson || "{}");
                } catch {
                  toast({ title: "JSON inválido", variant: "destructive" });
                  return Promise.resolve();
                }
                const body = { ...parsed, action: budAction, phone: (parsed.phone as string) || phone.trim() };
                if (!body.phone) {
                  toast({ title: "Informe telefone", variant: "destructive" });
                  return Promise.resolve();
                }
                return run(() => callEdgeJson("budgets-by-phone", { body }), "budgets-by-phone");
              }}
            >
              POST budgets-by-phone
            </Button>
          </div>
        </TabsContent>

        {/* —— Agendamentos —— */}
        <TabsContent value="appointments" className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input placeholder="5511999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="rounded-lg border border-slate-800 p-4 space-y-3">
            <p className="text-sm font-medium">POST add-appointment</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">title</Label>
                <Input value={apTitle} onChange={(e) => setApTitle(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">description (opcional)</Label>
                <Textarea rows={2} value={apDesc} onChange={(e) => setApDesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">date</Label>
                <Input type="date" value={apDate} onChange={(e) => setApDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">time (opcional)</Label>
                <Input value={apTime} onChange={(e) => setApTime(e.target.value)} placeholder="14:30" />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={loading || !phone.trim() || !apTitle.trim() || !apDate}
              onClick={() =>
                run(
                  () =>
                    callEdgeJson("add-appointment", {
                      body: {
                        phone: phone.trim(),
                        title: apTitle.trim(),
                        date: apDate,
                        ...(apDesc.trim() ? { description: apDesc.trim() } : {}),
                        ...(apTime.trim() ? { time: apTime.trim() } : {}),
                      },
                    }),
                  "Agendamento criado",
                )
              }
            >
              Criar agendamento
            </Button>
          </div>

          <div className="rounded-lg border border-slate-800 p-4 space-y-3">
            <p className="text-sm font-medium">GET get-appointments-by-phone</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading || !phone.trim()}
              onClick={() =>
                run(
                  () =>
                    callEdgeJson("get-appointments-by-phone", {
                      method: "GET",
                      query: { phone: phone.trim() },
                    }),
                  "Agendamentos listados",
                )
              }
            >
              Listar agendamentos
            </Button>
          </div>

          <div className="rounded-lg border border-slate-800 p-4 space-y-3">
            <p className="text-sm font-medium">PUT update-appointment-by-phone</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">appointment_id</Label>
                <Input value={apId} onChange={(e) => setApId(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">title (opcional)</Label>
                <Input value={apUpdTitle} onChange={(e) => setApUpdTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">date (opcional)</Label>
                <Input type="date" value={apDate} onChange={(e) => setApDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">time (opcional)</Label>
                <Input value={apTime} onChange={(e) => setApTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">status (opcional)</Label>
                <Input value={apStatus} onChange={(e) => setApStatus(e.target.value)} placeholder="pending / done" />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || !phone.trim() || !apId.trim()}
              onClick={() => {
                const body: Record<string, unknown> = {
                  phone: phone.trim(),
                  appointment_id: apId.trim(),
                };
                if (apUpdTitle.trim()) body.title = apUpdTitle.trim();
                if (apDate) body.date = apDate;
                if (apTime.trim()) body.time = apTime.trim();
                if (apStatus.trim()) body.status = apStatus.trim();
                if (apDesc.trim()) body.description = apDesc.trim();
                return run(() => callEdgeJson("update-appointment-by-phone", { method: "PUT", body }), "Agendamento atualizado");
              }}
            >
              Atualizar agendamento
            </Button>
          </div>

          <div className="rounded-lg border border-slate-800 p-4 space-y-3">
            <p className="text-sm font-medium">DELETE delete-appointment</p>
            <div className="space-y-2 max-w-md">
              <Label className="text-xs">appointment_id</Label>
              <Input value={apId} onChange={(e) => setApId(e.target.value)} />
            </div>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={loading || !phone.trim() || !apId.trim()}
              onClick={() =>
                run(
                  () =>
                    callEdgeJson("delete-appointment", {
                      method: "DELETE",
                      body: { phone: phone.trim(), appointment_id: apId.trim() },
                    }),
                  "Agendamento excluído",
                )
              }
            >
              Excluir agendamento
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-2">
        <Label className="text-xs text-slate-500">Última resposta</Label>
        <ScrollArea className="h-[220px] rounded-md border border-slate-800 bg-slate-950 p-3">
          <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all">
            {result || "Nenhuma chamada ainda."}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
};
