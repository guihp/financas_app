-- Add the promo_ends_at column to subscriptions
ALTER TABLE subscriptions
ADD COLUMN promo_ends_at TIMESTAMP WITH TIME ZONE;
