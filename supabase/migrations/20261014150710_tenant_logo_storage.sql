-- Isolated tenant brand logo storage. No changes to the cover-photo bucket.
-- tenants.logo_url already exists and stores a tenant-owned bucket-relative path.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('tenant-logos','tenant-logos',true,1048576,ARRAY['image/png'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenant_logo_path_is_scoped CHECK (
    logo_url IS NULL OR (
      split_part(logo_url,'/',1) = id::text
      AND logo_url ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]png$'
    )
  );

CREATE POLICY tenant_logos_owner_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='tenant-logos'
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]png$'
  AND EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.user_id=(SELECT auth.uid())
    AND p.role='owner' AND p.is_active IS TRUE
    AND p.tenant_id::text=(storage.foldername(name))[1])
);

CREATE POLICY tenant_logos_owner_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id='tenant-logos'
  AND EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.user_id=(SELECT auth.uid())
    AND p.role='owner' AND p.is_active IS TRUE
    AND p.tenant_id::text=(storage.foldername(name))[1])
);

CREATE POLICY tenant_logos_owner_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id='tenant-logos'
  AND EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.user_id=(SELECT auth.uid())
    AND p.role='owner' AND p.is_active IS TRUE
    AND p.tenant_id::text=(storage.foldername(name))[1])
);
