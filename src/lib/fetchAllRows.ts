import type { PostgrestError } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

/**
 * O PostgREST do Supabase devolve no máximo 1000 linhas por requisição (max_rows).
 * Sem paginar, usuários com mais de 1000 transações perdem as mais antigas e o
 * saldo fica errado. Esta função busca todas as páginas via .range().
 *
 * `build` precisa criar uma query NOVA a cada chamada (o builder não é reutilizável)
 * e ter uma ordenação estável — inclua `.order("id")` como desempate.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows<T = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: () => any
): Promise<{ data: T[]; error: PostgrestError | null }> {
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
