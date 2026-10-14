-- Optional tenant-scoped barbershop cover: metadata and public photo storage.
-- The object URL is public intentionally; writes remain tenant-owner only.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cover_image_path text,
  ADD COLUMN IF NOT EXISTS cover_image_position integer NOT NULL DEFAULT 50
    CHECK (cover_image_position BETWEEN 0 AND 100);

ALTER TABLE public.tenants
  ADD CONSTRAINT tenant_cover_must_belong_to_tenant CHECK (
    cover_image_path IS NULL OR (
      split_part(cover_image_path, '/', 1) = id::text
      AND cover_image_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$'
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tenant-covers', 'tenant-covers', true, 1572864, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- No storage policy for other roles and no UPDATE (new version uses new key).
CREATE POLICY "tenant_covers_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tenant-covers'
  AND name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.role = 'owner' AND p.is_active IS TRUE
      AND p.tenant_id::text = (storage.foldername(name))[1]
  )
);

-- Owner SELECT required for clean-up and delete; object URL reads are public.
CREATE POLICY "tenant_covers_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'tenant-covers'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.role = 'owner' AND p.is_active IS TRUE
      AND p.tenant_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "tenant_covers_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'tenant-covers'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.role = 'owner' AND p.is_active IS TRUE
      AND p.tenant_id::text = (storage.foldername(name))[1]
  )
);
