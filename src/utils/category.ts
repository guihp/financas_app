import { FIXED_CATEGORIES } from "@/constants/financialData";

/**
 * Normaliza a categoria recebida (slug ou label) para o slug canônico em
 * FIXED_CATEGORIES. Categorias custom (não encontradas) são retornadas como vieram.
 *
 * Garante que tetos de orçamento (que usam slug) batam com transações criadas
 * por qualquer fluxo (API, app, formulários antigos).
 */
export function normalizeCategorySlug(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  const bySlug = FIXED_CATEGORIES.find((c) => c.value === trimmed);
  if (bySlug) return bySlug.value;

  const lower = trimmed.toLowerCase();
  const byLabel = FIXED_CATEGORIES.find((c) => c.label.toLowerCase() === lower);
  if (byLabel) return byLabel.value;

  return trimmed;
}
