-- Make the loan-documents bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'loan-documents';