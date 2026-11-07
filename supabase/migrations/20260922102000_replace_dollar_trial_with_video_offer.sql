-- Replace the retired $1 / 3-day trial with the $7 / 7-day video offer.
UPDATE public.billing_catalog
SET usd_price = 7, egp_price = 349, trial_days = 7
WHERE tier = 'pro' AND interval = 'monthly_trial';
