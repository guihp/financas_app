-- Listas de compras (alinhado ao app: ListaComprasPage)
-- RLS no mesmo padrão de contas compartilhadas (get_connected_user_ids).

CREATE TABLE IF NOT EXISTS public.shopping_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    budget numeric NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    finished_at timestamptz,
    final_value numeric,
    payment_method text,
    bank_id uuid,
    credit_card_id uuid,
    is_reused boolean NOT NULL DEFAULT false,
    reuse_reference_date timestamptz,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.shopping_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    category text NOT NULL,
    quantity numeric NOT NULL DEFAULT 1,
    unit_type text NOT NULL DEFAULT 'un' CHECK (unit_type IN ('un', 'kg')),
    weight_per_unit numeric NOT NULL DEFAULT 0,
    price numeric NOT NULL DEFAULT 0,
    checked boolean NOT NULL DEFAULT false,
    require_price boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_user_id ON public.shopping_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_list_id ON public.shopping_items(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_user_id ON public.shopping_items(user_id);

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- shopping_lists policies
DROP POLICY IF EXISTS "shopping_lists_select_own_shared" ON public.shopping_lists;
CREATE POLICY "shopping_lists_select_own_shared" ON public.shopping_lists
    FOR SELECT USING (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "shopping_lists_insert_own_shared" ON public.shopping_lists;
CREATE POLICY "shopping_lists_insert_own_shared" ON public.shopping_lists
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "shopping_lists_update_own_shared" ON public.shopping_lists;
CREATE POLICY "shopping_lists_update_own_shared" ON public.shopping_lists
    FOR UPDATE USING (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "shopping_lists_delete_own_shared" ON public.shopping_lists;
CREATE POLICY "shopping_lists_delete_own_shared" ON public.shopping_lists
    FOR DELETE USING (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

-- shopping_items policies
DROP POLICY IF EXISTS "shopping_items_select_own_shared" ON public.shopping_items;
CREATE POLICY "shopping_items_select_own_shared" ON public.shopping_items
    FOR SELECT USING (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "shopping_items_insert_own_shared" ON public.shopping_items;
CREATE POLICY "shopping_items_insert_own_shared" ON public.shopping_items
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "shopping_items_update_own_shared" ON public.shopping_items;
CREATE POLICY "shopping_items_update_own_shared" ON public.shopping_items
    FOR UPDATE USING (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "shopping_items_delete_own_shared" ON public.shopping_items;
CREATE POLICY "shopping_items_delete_own_shared" ON public.shopping_items
    FOR DELETE USING (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );
