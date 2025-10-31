-- Add paid_by column to payments table
ALTER TABLE public.payments 
ADD COLUMN paid_by text;