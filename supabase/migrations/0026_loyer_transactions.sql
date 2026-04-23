-- Migration 0026 — Architecture transit Airbnb pour loyers
-- L'argent transite par le compte Althy (QR-facture → réception → reversement)

CREATE TABLE IF NOT EXISTS loyer_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bien_id UUID NOT NULL REFERENCES biens(id),
    tenant_id UUID REFERENCES auth.users(id),
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    montant_total NUMERIC(10,2) NOT NULL,           -- Ce que le locataire paie (ex: 1500)
    commission_pct NUMERIC(5,4) NOT NULL DEFAULT 0.03,  -- 3%
    commission_montant NUMERIC(10,2) NOT NULL,       -- ex: 45
    montant_reverse NUMERIC(10,2) NOT NULL,          -- ex: 1455
    qr_reference VARCHAR(27),                        -- Référence QR unique (27 chiffres) pour réconciliation
    statut VARCHAR(20) NOT NULL DEFAULT 'en_attente',
        -- en_attente | recu | reverse | en_retard | conteste
    mois_concerne DATE NOT NULL,                     -- Premier du mois concerné
    date_reception TIMESTAMPTZ,                      -- Quand l'argent est arrivé sur IBAN Althy
    date_reversement TIMESTAMPTZ,                    -- Quand Althy a reversé au proprio
    reference_virement_sortant VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_loyer_tx_owner ON loyer_transactions(owner_id);
CREATE INDEX ix_loyer_tx_bien  ON loyer_transactions(bien_id);
CREATE INDEX ix_loyer_tx_qr_ref   ON loyer_transactions(qr_reference);
CREATE INDEX ix_loyer_tx_statut   ON loyer_transactions(statut);
CREATE UNIQUE INDEX ix_loyer_tx_qr_ref_unique ON loyer_transactions(qr_reference)
    WHERE qr_reference IS NOT NULL;

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION update_loyer_tx_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_loyer_tx_updated_at
    BEFORE UPDATE ON loyer_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_loyer_tx_updated_at();

-- RLS
ALTER TABLE loyer_transactions ENABLE ROW LEVEL SECURITY;

-- Le proprio voit ses propres transactions
CREATE POLICY "proprio_read_own" ON loyer_transactions
    FOR SELECT USING (owner_id = auth.uid());

-- Le locataire voit ses propres transactions
CREATE POLICY "tenant_read_own" ON loyer_transactions
    FOR SELECT USING (tenant_id = auth.uid());

-- Seuls les service_role (backend) peuvent écrire
CREATE POLICY "service_role_all" ON loyer_transactions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
