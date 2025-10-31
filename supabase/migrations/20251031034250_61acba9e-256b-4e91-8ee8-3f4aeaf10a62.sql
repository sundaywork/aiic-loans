-- Drop the existing check constraint
ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_status_check;

-- Add a new check constraint that includes 'cancelled'
ALTER TABLE public.loans ADD CONSTRAINT loans_status_check 
CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled'));