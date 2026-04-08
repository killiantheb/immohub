-- ============================================================
-- Althy — Row Level Security policies (0006)
-- À exécuter après la migration Alembic 0006
-- Nécessite que auth.uid() soit disponible (Supabase)
-- ============================================================

-- Helper : récupère le role de l'utilisateur courant depuis la table users
-- (le JWT Supabase contient le sub = supabase_uid)
CREATE OR REPLACE FUNCTION althy_current_user_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM users WHERE supabase_uid = auth.uid()::text
$$;

CREATE OR REPLACE FUNCTION althy_current_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT role FROM users WHERE supabase_uid = auth.uid()::text
$$;

-- ============================================================
-- 1. biens
-- ============================================================
-- Admin voit tout
CREATE POLICY "admin_all_biens" ON biens
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

-- Propriétaire voit / modifie ses biens
CREATE POLICY "owner_own_biens" ON biens
  FOR ALL TO authenticated
  USING (owner_id = althy_current_user_id());

-- Locataire voit le bien où il habite
CREATE POLICY "tenant_read_bien" ON biens
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT bien_id FROM locataires
      WHERE user_id = althy_current_user_id() AND statut = 'actif'
    )
  );

-- ============================================================
-- 2. locataires
-- ============================================================
CREATE POLICY "admin_all_locataires" ON locataires
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

CREATE POLICY "owner_locataires_of_their_biens" ON locataires
  FOR ALL TO authenticated
  USING (
    bien_id IN (SELECT id FROM biens WHERE owner_id = althy_current_user_id())
  );

CREATE POLICY "tenant_own_locataire" ON locataires
  FOR SELECT TO authenticated
  USING (user_id = althy_current_user_id());

-- ============================================================
-- 3. dossiers_locataires
-- ============================================================
CREATE POLICY "admin_all_dossiers" ON dossiers_locataires
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

CREATE POLICY "owner_dossiers_of_their_locataires" ON dossiers_locataires
  FOR ALL TO authenticated
  USING (
    locataire_id IN (
      SELECT l.id FROM locataires l
      JOIN biens b ON b.id = l.bien_id
      WHERE b.owner_id = althy_current_user_id()
    )
  );

CREATE POLICY "tenant_own_dossier" ON dossiers_locataires
  FOR SELECT TO authenticated
  USING (
    locataire_id IN (
      SELECT id FROM locataires WHERE user_id = althy_current_user_id()
    )
  );

-- ============================================================
-- 4. documents
-- ============================================================
CREATE POLICY "admin_all_documents" ON documents
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

CREATE POLICY "owner_documents_of_their_biens" ON documents
  FOR ALL TO authenticated
  USING (
    bien_id IN (SELECT id FROM biens WHERE owner_id = althy_current_user_id())
  );

CREATE POLICY "tenant_own_documents" ON documents
  FOR SELECT TO authenticated
  USING (
    locataire_id IN (
      SELECT id FROM locataires WHERE user_id = althy_current_user_id()
    )
  );

-- ============================================================
-- 5. paiements
-- ============================================================
CREATE POLICY "admin_all_paiements" ON paiements
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

CREATE POLICY "owner_paiements_of_their_biens" ON paiements
  FOR ALL TO authenticated
  USING (
    bien_id IN (SELECT id FROM biens WHERE owner_id = althy_current_user_id())
  );

CREATE POLICY "tenant_own_paiements" ON paiements
  FOR SELECT TO authenticated
  USING (
    locataire_id IN (
      SELECT id FROM locataires WHERE user_id = althy_current_user_id()
    )
  );

-- ============================================================
-- 6. interventions
-- ============================================================
CREATE POLICY "admin_all_interventions" ON interventions
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

CREATE POLICY "owner_interventions_of_their_biens" ON interventions
  FOR ALL TO authenticated
  USING (
    bien_id IN (SELECT id FROM biens WHERE owner_id = althy_current_user_id())
  );

-- Artisan voit les interventions qui lui sont assignées
CREATE POLICY "artisan_assigned_interventions" ON interventions
  FOR SELECT TO authenticated
  USING (artisan_id = althy_current_user_id());

-- Locataire voit les interventions de son bien (lecture seule)
CREATE POLICY "tenant_read_interventions" ON interventions
  FOR SELECT TO authenticated
  USING (
    bien_id IN (
      SELECT bien_id FROM locataires
      WHERE user_id = althy_current_user_id() AND statut = 'actif'
    )
  );

-- ============================================================
-- 7. devis
-- ============================================================
CREATE POLICY "admin_all_devis" ON devis
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

CREATE POLICY "artisan_own_devis" ON devis
  FOR ALL TO authenticated
  USING (artisan_id = althy_current_user_id());

CREATE POLICY "owner_devis_on_their_interventions" ON devis
  FOR SELECT TO authenticated
  USING (
    intervention_id IN (
      SELECT i.id FROM interventions i
      JOIN biens b ON b.id = i.bien_id
      WHERE b.owner_id = althy_current_user_id()
    )
  );

-- ============================================================
-- 8. missions_ouvreurs
-- ============================================================
CREATE POLICY "admin_all_missions_ouvreurs" ON missions_ouvreurs
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

-- Agence voit et gère ses missions
CREATE POLICY "agence_own_missions" ON missions_ouvreurs
  FOR ALL TO authenticated
  USING (agence_id = althy_current_user_id());

-- Propriétaire voit les missions sur ses biens
CREATE POLICY "owner_missions_on_their_biens" ON missions_ouvreurs
  FOR SELECT TO authenticated
  USING (
    bien_id IN (SELECT id FROM biens WHERE owner_id = althy_current_user_id())
  );

-- Ouvreur voit les missions qui lui sont proposées ou assignées
CREATE POLICY "ouvreur_own_missions" ON missions_ouvreurs
  FOR SELECT TO authenticated
  USING (
    ouvreur_id = althy_current_user_id()
    OR statut = 'proposee'
  );

CREATE POLICY "ouvreur_update_own_missions" ON missions_ouvreurs
  FOR UPDATE TO authenticated
  USING (ouvreur_id = althy_current_user_id());

-- ============================================================
-- 9. profiles_ouvreurs
-- ============================================================
CREATE POLICY "admin_all_profiles_ouvreurs" ON profiles_ouvreurs
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

-- Lecture publique pour les agences/proprio qui cherchent un ouvreur
CREATE POLICY "auth_read_profiles_ouvreurs" ON profiles_ouvreurs
  FOR SELECT TO authenticated
  USING (true);

-- L'ouvreur gère son propre profil
CREATE POLICY "ouvreur_own_profile" ON profiles_ouvreurs
  FOR ALL TO authenticated
  USING (user_id = althy_current_user_id());

-- ============================================================
-- 10. profiles_artisans
-- ============================================================
CREATE POLICY "admin_all_profiles_artisans" ON profiles_artisans
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

CREATE POLICY "auth_read_profiles_artisans" ON profiles_artisans
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "artisan_own_profile" ON profiles_artisans
  FOR ALL TO authenticated
  USING (user_id = althy_current_user_id());

-- ============================================================
-- 11. scoring_locataires
-- ============================================================
CREATE POLICY "admin_all_scoring" ON scoring_locataires
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

-- Proprio lit le scoring des locataires de ses biens
CREATE POLICY "owner_scoring_of_their_locataires" ON scoring_locataires
  FOR SELECT TO authenticated
  USING (
    locataire_id IN (
      SELECT l.id FROM locataires l
      JOIN biens b ON b.id = l.bien_id
      WHERE b.owner_id = althy_current_user_id()
    )
  );

-- ============================================================
-- 12. notifications
-- ============================================================
CREATE POLICY "admin_all_notifications" ON notifications
  FOR ALL TO authenticated
  USING (althy_current_role() IN ('admin', 'super_admin'));

-- Chaque user ne voit que ses propres notifications
CREATE POLICY "user_own_notifications" ON notifications
  FOR ALL TO authenticated
  USING (user_id = althy_current_user_id());
