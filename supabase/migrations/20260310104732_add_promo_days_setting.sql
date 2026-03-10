-- Add the promo_days column to app_settings
ALTER TABLE app_settings
ADD COLUMN promo_days INTEGER;
