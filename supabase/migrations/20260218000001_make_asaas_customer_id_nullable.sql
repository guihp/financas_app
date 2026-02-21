-- Make asaas_customer_id nullable to allow trial subscriptions without payment method configured
ALTER TABLE public.subscriptions 
ALTER COLUMN asaas_customer_id DROP NOT NULL;
