# ADR-0004 — Identity provider abstraction; Microsoft Entra ID first

- **Status:** accepted (product-owner decision 2026-10-07)
- **Decision:**
  - `backend/rook/identity/` defines an `IdentityProvider` interface (authorisation URL, code exchange, claim validation). `EntraIdProvider` is the first implementation (OIDC authorisation-code flow with PKCE, confidential client).
  - Login state (`state`, `nonce`, PKCE verifier, purpose, return path) is stored server-side in `auth_states`, is single-use, and expires after 10 minutes.
  - ID-token handling: tokens are received directly from the token endpoint over TLS by a confidential client, so per OIDC Core §3.1.3.7 TLS server validation is used in place of signature validation. ROOK still validates `iss`, `aud`, `tid`, `exp`, `nonce`. JWKS signature validation is a hardening item before multi-tenant SaaS.
  - Tenant mapping: an Entra tenant (`tid`) maps to exactly one ROOK organisation (`Organization.external_ref = "entra:<tid>"`). Only `MICROSOFT_TENANT_ID` is accepted in the MVP (single-tenant).
  - Users are provisioned on first sign-in as `member`. Emails in `ROOK_ADMIN_EMAILS` become `admin`.
  - ROOK issues its own short-lived HMAC session token. The passwordless dev login stays for the demo tenant only and must be disabled (`ROOK_DEV_LOGIN=false`) in shared environments.
  - Connector OAuth tokens are encrypted at rest with Fernet (`cryptography`), using the key from `ROOK_ENCRYPTION_KEY`.
- **New dependency:** `cryptography` (widely used, audited, open source). Alternative considered: storing tokens in a cloud KMS. Deferred until the deployment target is chosen.
