-- Migration 0039 : Bucket Supabase Storage "edl-photos" + RLS
--
-- Stocke les photos d'État Des Lieux (EDL) prises pendant les phases
-- check-out (sortie) et check-in (entrée) du cycle changements_locataire.
--
-- Choix architecturaux :
--   - Bucket PRIVÉ (public = false) : les photos d'EDL sont sensibles
--     (état dégradé, dommages) et ne doivent JAMAIS être accessibles via
--     URL publique permanente. Le frontend reçoit une signed URL (TTL 1h)
--     générée par le backend à chaque GET / upload.
--   - Path : {changement_id}/{edl_type}/piece_{piece_idx}/{uuid}.jpg
--     edl_type ∈ {entree, sortie} — alignement FR canonique projet.
--   - Insertions exclusivement via service-role (backend FastAPI).
--     Les users ne sont pas autorisés à uploader directement depuis Supabase.
--   - RLS : un user peut LIRE/SUPPRIMER uniquement les objets attachés à
--     un changement dont il est propriétaire du bien (jointure via
--     storage.foldername(name)[1] = changement_id → biens.owner_id).

-- 1. Créer le bucket (privé, JPEG/PNG/WebP, 10 MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'edl-photos',
  'edl-photos',
  false,
  10485760,  -- 10 MB par fichier (aligné MAX_FILE_SIZE backend)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS — lecture limitée au propriétaire du bien rattaché au changement
CREATE POLICY "Owner reads EDL photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'edl-photos'
    AND EXISTS (
      SELECT 1
      FROM changements_locataire cl
      JOIN biens b ON b.id = cl.bien_id
      WHERE cl.id::text = (storage.foldername(name))[1]
        AND b.owner_id = auth.uid()
    )
  );

-- 3. RLS — suppression limitée au propriétaire du bien rattaché au changement
CREATE POLICY "Owner deletes EDL photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'edl-photos'
    AND EXISTS (
      SELECT 1
      FROM changements_locataire cl
      JOIN biens b ON b.id = cl.bien_id
      WHERE cl.id::text = (storage.foldername(name))[1]
        AND b.owner_id = auth.uid()
    )
  );

-- Pas de policy INSERT : seul le service_role (backend) peut uploader.
