-- Add the enable_promo_code column to app_settings, default true
ALTER TABLE app_settings
ADD COLUMN enable_promo_code BOOLEAN NOT NULL DEFAULT TRUE;
