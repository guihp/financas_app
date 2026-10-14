const PAGE_SIZE = 1000;

/**
 * PostgREST devolve no máximo 1000 linhas por requisição (max_rows). Sem paginar,
 * usuários com mais de 1000 transações têm saldos/totais calculados pela metade.
 * `build` deve devolver a query com ordenação estável (inclua `.order('id')`).
 */
// deno-lint-ignore no-explicit-any
export async function fetchAllRows<T = any>(build: () => any): Promise<{ data: T[]; error: any }> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) return { data: all, error };
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return { data: all, error: null };
}
