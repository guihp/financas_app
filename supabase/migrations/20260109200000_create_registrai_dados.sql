-- Create table registraAi_dados
CREATE TABLE IF NOT EXISTS public."registraAi_dados" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT,
    id_conversa TEXT,
    inicio_int TIMESTAMPTZ,
    ultm_int TIMESTAMPTZ,
    ia_ativa BOOLEAN DEFAULT NULL,
    "ChatDesativado" TEXT,
    rmkt_ja_enviado BOOLEAN DEFAULT NULL,
    "data agendada" TIMESTAMPTZ,
    "Fluxo" TEXT,
    "Teste_IA" TEXT,
    "ID brevo" TEXT,
    "ID negociação" TEXT,
    email TEXT,
    "qtdInteracao" INTEGER DEFAULT 0,
    "RMK_ATIVO" BOOLEAN DEFAULT FALSE,
    remarketing TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on id_conversa for faster lookups
CREATE INDEX IF NOT EXISTS idx_registrai_dados_id_conversa ON public."registraAi_dados" (id_conversa);

-- Create index on email
CREATE INDEX IF NOT EXISTS idx_registrai_dados_email ON public."registraAi_dados" (email);

-- Enable RLS
ALTER TABLE public."registraAi_dados" ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read their own data
CREATE POLICY "Users can view their own data" ON public."registraAi_dados"
    FOR SELECT
    USING (true);

-- Create policy for service role to manage all data
CREATE POLICY "Service role can manage all data" ON public."registraAi_dados"
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_registrai_dados_updated_at
    BEFORE UPDATE ON public."registraAi_dados"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
