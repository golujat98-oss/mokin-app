-- Create storage buckets for Logos, QRs, and Signatures if they do not exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('logos', 'logos', true),
  ('qrs', 'qrs', true),
  ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Policy for Public Read Access
CREATE POLICY "Allow public read access to app assets" ON storage.objects
FOR SELECT
USING (bucket_id IN ('logos', 'qrs', 'signatures'));

-- 2. Policy for Authenticated Uploads (Insert)
CREATE POLICY "Allow authenticated users to upload their own app assets" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('logos', 'qrs', 'signatures') AND
  starts_with(name, auth.uid()::text)
);

-- 3. Policy for Authenticated Updates
CREATE POLICY "Allow authenticated users to update their own app assets" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('logos', 'qrs', 'signatures') AND
  starts_with(name, auth.uid()::text)
)
WITH CHECK (
  bucket_id IN ('logos', 'qrs', 'signatures') AND
  starts_with(name, auth.uid()::text)
);

-- 4. Policy for Authenticated Deletes
CREATE POLICY "Allow authenticated users to delete their own app assets" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('logos', 'qrs', 'signatures') AND
  starts_with(name, auth.uid()::text)
);
