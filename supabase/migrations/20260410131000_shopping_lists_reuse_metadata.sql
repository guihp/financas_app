-- Metadados de reutilização (nome + data de referência exibidos na UI)
ALTER TABLE public.shopping_lists
  ADD COLUMN IF NOT EXISTS is_reused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reuse_reference_date timestamptz;

COMMENT ON COLUMN public.shopping_lists.is_reused IS 'Lista criada pelo fluxo Reutilizar';
COMMENT ON COLUMN public.shopping_lists.reuse_reference_date IS 'Data da lista de origem (ex.: finished_at) para exibição';
