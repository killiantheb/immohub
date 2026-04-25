# Rollback procedure backend/.env

## État courant après Phase C (session 8)
## Hashes SHA256 (audit trail)

- .env.prod-backup : fe12db1678fe48b9091b5c27bc14862d5e3f643d996ecf21c00cef5532d772c3
- .env.staging     : 1b9c61e36453416e609b5b10d9f9511c17f4434279392ba8ad309025edd460c9

## Switch prod <-> staging

### Vers PROD (rollback)
cd /c/Users/Killan/immohub/backend
cp .env.prod-backup .env
sha256sum .env  # doit retourner fe12db167...
alembic current  # doit retourner 0028

### Vers STAGING
cd /c/Users/Killan/immohub/backend
cp .env.staging .env
sha256sum .env  # doit retourner 1b9c61e36...
alembic current  # doit retourner 0028 (puis 0029 apres migration test)

## Differences cles prod vs staging dans le .env

- DATABASE_URL port : 6543 prod (Transaction Pooler) | 5432 staging (Session Pooler)
- DATABASE_URL user : postgres.zvcjaiqfinmxguiyozzu | postgres.uystpsndbyrcbuifjkzo
- SUPABASE_URL : zvcjaiqfinmxguiyozzu.supabase.co | uystpsndbyrcbuifjkzo.supabase.co
- SUPABASE_SERVICE_KEY : JWT prod 219 chars | JWT staging 219 chars
- SUPABASE_JWT_SECRET : secret prod 88 chars | secret staging 88 chars

Autres vars (Stripe, Resend, Twilio, OpenAI) identiques prod/staging.

## Decision technique session 8

DATABASE_URL staging utilise Session Pooler 5432 au lieu de Transaction
Pooler 6543 pour eviter conflits potentiels avec operations longues
d'alembic dans 0029 (CREATE TYPE, ALTER TABLE boucle, DROP TABLE CASCADE).

Pour prod, decision finale (6543 vs 5432 pendant migration) a prendre
separement apres validation de 0029 sur staging.
