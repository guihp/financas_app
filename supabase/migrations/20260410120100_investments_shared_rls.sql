-- Caixinhas: permitir leitura/escrita entre contas vinculadas (mesmo padrão de transactions).

DROP POLICY IF EXISTS "Users can view their own investments" ON public.investments;
CREATE POLICY "investments_select_own_shared" ON public.investments
    FOR SELECT USING (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can insert their own investments" ON public.investments;
CREATE POLICY "investments_insert_own_shared" ON public.investments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can update their own investments" ON public.investments;
CREATE POLICY "investments_update_own_shared" ON public.investments
    FOR UPDATE USING (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can delete their own investments" ON public.investments;
CREATE POLICY "investments_delete_own_shared" ON public.investments
    FOR DELETE USING (
        auth.uid() = user_id
        OR user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );
