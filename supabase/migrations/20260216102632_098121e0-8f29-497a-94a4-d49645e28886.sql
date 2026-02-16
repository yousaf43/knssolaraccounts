-- Make logos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'logos';

-- Remove public SELECT policy
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;

-- Add authenticated-only SELECT policy
CREATE POLICY "Authenticated users can view logos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'logos');