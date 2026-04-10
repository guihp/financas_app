ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS quote_symbol text,
  ADD COLUMN IF NOT EXISTS quantity_units numeric;

COMMENT ON COLUMN public.investments.quote_symbol IS 'Ticker B3 (ex: PETR4) ou símbolo/ID CoinGecko (ex: btc, bitcoin)';
COMMENT ON COLUMN public.investments.quantity_units IS 'Quantidade de ativos para marcar preço (aporte BRL / cotação)';
