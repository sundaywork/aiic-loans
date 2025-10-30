-- Drop existing foreign keys that point to auth.users
ALTER TABLE public.loan_applications
DROP CONSTRAINT IF EXISTS loan_applications_user_id_fkey;

ALTER TABLE public.loans
DROP CONSTRAINT IF EXISTS loans_user_id_fkey;

ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_user_id_fkey;

-- Add new foreign keys that point to profiles
ALTER TABLE public.loan_applications
ADD CONSTRAINT loan_applications_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.loans
ADD CONSTRAINT loans_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.payments
ADD CONSTRAINT payments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;