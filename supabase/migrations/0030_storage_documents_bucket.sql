-- Migration 0030: Bucket Supabase Storage "documents" + RLS
-- Stocke les quittances et QR-factures gén��rées par Althy.

-- 1. Créer le bucket (privé �� pas d'accès public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  5242880,  -- 5 MB max par fichier
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS — le propriétaire ne voit que ses propres documents
-- Structure des chemins : {user_id}/{property_id}/{type}_{mois}.pdf

-- Lecture : le user ne peut lire que les fichiers dans son dossier
CREATE POLICY "Users can read own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Insertion : le service_role insère (backend), pas les users directement
-- Pas de policy INSERT pour les users — seul le service_key peut uploader

-- Suppression : le user peut supprimer ses propres documents
CREATE POLICY "Users can delete own documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
