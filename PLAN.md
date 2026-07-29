# OutlookReader Plan (GitHub Pages-First, Static-Only)

## Summary
Build OutlookReader as a static React web app (GitHub Pages compatible) that reads Outlook/Hotmail mail via Microsoft Graph using the same credential input format you provided: `email:password:refresh_token:client_id`.  
Because you chose pure static hosting, there is no backend token broker. Token exchange and Graph calls happen in-browser, with strong client-side hardening and clear privacy warnings.

## Architecture and Hosting
1. Use `React + TypeScript + Vite + Tailwind + shadcn/ui` for maximum static-host portability.
2. Use `react-router-dom` with hash-based routing (`/#/...`) to avoid static host rewrite issues across GitHub Pages and similar hosts.
3. Use `Zustand` for lightweight, predictable client state management (vault state, selected account, cached inbox).
4. Add host portability config:
- `VITE_BASE_PATH` for repo subpath deploys.
- `VITE_GRAPH_BASE_URL` default `https://graph.microsoft.com/v1.0`.
- `VITE_TOKEN_URL` default `https://login.microsoftonline.com/common/oauth2/v2.0/token`.
5. Provide deployment targets:
- GitHub Pages (primary).
- Netlify static.
- Cloudflare Pages static.
- Vercel static export.
6. Add GitHub Actions workflow to build and publish static artifacts to Pages.

## Security and Privacy Model (Static Constraints)
1. Parse strict credential format `email:password:refresh_token:client_id`.
2. Preserve compatibility but ignore `password` after parsing.
3. Encrypt stored account records in browser using Web Crypto:
- PBKDF2 key derivation from vault passphrase.
- AES-GCM encryption for account payloads.
- Store only encrypted blobs in IndexedDB.
4. Add session modes:
- Persistent encrypted vault (default).
- Ephemeral session-only mode (recommended for shared devices).
5. Secure Memory Lifecycle:
- Ensure decrypted account details and tokens are explicitly cleared from memory/React state when the vault is locked or the session ends.
6. Never log raw credentials/tokens to console, telemetry, or UI errors.
7. Sanitize HTML emails before rendering using `DOMPurify` to prevent XSS.
8. Set strict CSP via `<meta http-equiv="Content-Security-Policy">` (with static-host limitations documented).
9. Add strong dependency hygiene:
- lockfile, automated dependency PRs, pnpm audit checks in CI.
- Use `pnpm` exclusively for package management.
10. Explicitly document static-host risk:
- any XSS can expose in-browser refresh tokens.
- require low-privilege app registration and `Mail.Read` & `offline_access` permissions only.

## UX/UI Plan (Desktop + Mobile)
1. Build a 3-pane desktop layout:
- Account switcher pane.
- Inbox list pane.
- Message detail pane.
2. Build a mobile-first stacked layout:
- Bottom nav for Accounts/Inbox/Message.
- Swipe-friendly list/detail transitions.
3. Use shadcn components:
- `Sidebar`, `Sheet`, `Dialog`, `Command`, `Card`, `Tabs`, `Input`, `Button`, `Badge`, `Skeleton`, `Toast`.
4. Accessibility rules:
- touch targets >= 44px.
- keyboard navigation and visible focus rings.
- WCAG contrast target 4.5:1.
- reduced-motion support.
5. Feedback states:
- vault locked/unlocked state.
- token refresh failure states (prompting re-import if refresh token is revoked/expired).
- Graph rate-limit states.
- network resiliency (offline indicators and retry actions).
- empty inbox/loading/skeleton states.

## Feature Scope (v1)
1. Account import from raw credential string.
2. Encrypted multi-account storage and quick account switching.
3. Inbox listing from Graph:
- subject, sender, preview, timestamp, read/unread.
4. Message detail view:
- safe plain preview.
- sanitized HTML view toggle.
- inline image handling (note: loading `cid:` images natively via Graph requires extracting attachments/content, which may be complex; v1 might omit or strip inline images for security/simplicity).
5. Search/filter:
- local list search for loaded messages.
- optional server-side Graph query mode if endpoint behavior allows.
6. Pagination:
- support Graph paging with `@odata.nextLink`.
7. Read-only only:
- no send/reply/delete/move in v1.

## Public Interfaces, Types, and API Surface
Changes from earlier backend plan:
1. Remove internal server API routes (`/api/...`) entirely.
2. Replace with client-side service interfaces:

`parseCredentialString(raw: string): ParsedCredential`  
`encryptAccount(record: ParsedCredential, passphrase: string): Promise<EncryptedAccountRecord>`  
`decryptAccount(record: EncryptedAccountRecord, passphrase: string): Promise<DecryptedAccount>`  
`exchangeRefreshToken(input: DecryptedAccount): Promise<TokenResponse>`  
`fetchInbox(accessToken: string, paging?: PagingInput): Promise<InboxResponse>`  
`fetchMessage(accessToken: string, messageId: string): Promise<MessageDetail>`

3. Token Lifecycle Interceptor:
- Implement wrapper or interceptor around `fetch` that automatically catches `401 Unauthorized` responses from Graph, attempts `exchangeRefreshToken()`, updates state, and retries the failed request.

Core types:
1. `ParsedCredential`: `{ email, passwordIgnored: true, refreshToken, clientId }`
2. `EncryptedAccountRecord`: `{ id, email, clientId, cipherText, iv, salt, createdAt, updatedAt }`
3. `TokenResponse`: `{ accessToken, expiresIn, refreshToken? }`
4. `InboxMessage`: `{ id, subject, from, bodyPreview, receivedDateTime, isRead }`
5. `MessageDetail`: `{ id, subject, from, toRecipients, bodyPreview, bodyHtmlRaw, bodyHtmlSanitized }`

## Implementation Phases
1. Bootstrap project and static deployment pipeline.
2. Build design tokens, typography, responsive layout shell, and shadcn primitives.
3. Implement credential parser and validation.
4. Implement encrypted vault (IndexedDB + crypto), lock/unlock UX, and Zustand state store.
5. Implement Graph token exchange, automatic token refresh lifecycle, and inbox/message fetch services.
6. Implement inbox/detail views, account switcher, pagination, and search.
7. Add sanitization, CSP meta policy, and security hardening checks.
8. Add comprehensive tests and documentation.

## Testing and Acceptance Criteria
1. Unit tests:
- strict parser acceptance/rejection cases.
- encryption/decryption roundtrip and wrong-passphrase failure.
- token response parsing and error mapping.
2. Component tests:
- account switcher behavior.
- locked vault gating.
- sanitized HTML rendering path.
3. Integration tests (mocked network):
- token exchange success/failure.
- automatic 401 token refresh retry logic.
- inbox pagination and message detail retrieval.
- handling 401/429/retry-after.
4. E2E tests (Playwright):
- desktop and mobile import -> unlock -> fetch -> read -> switch account flow.
- persistence behavior across reload.
- ephemeral mode non-persistence.
5. Security tests:
- XSS payload fixture in message HTML is neutralized.
- no sensitive values in UI/log output.
- CSP meta exists in built `index.html`.

## Documentation and Open-Source Readiness
1. `README.md`:
- quick start and local dev.
- GitHub Pages deployment steps.
- supported static hosts.
- credential format examples.
- threat model and privacy caveats.
2. `SECURITY.md`:
- vulnerability disclosure policy.
- secure usage guidance.
- known static-host limitations.
3. `CONTRIBUTING.md`:
- coding style.
- comment standards (JSDoc on exports + explanatory comments for crypto/network/security-critical logic).
- test requirements before PR.
4. Add sample screenshots/GIF for desktop/mobile usage in repo docs.

## Assumptions and Defaults
1. GitHub Pages-first portability is prioritized over backend security isolation.
2. `password` segment is compatibility-only and never used for Graph.
3. Users provide valid refresh token + client ID from their own Entra app context.
4. v1 Graph permission scope is read-only mailbox access (`Mail.Read` + `offline_access`).
5. Microsoft Entra App Configuration Requirement: To allow in-browser POST requests to the `/token` endpoint without CORS errors, the underlying Client ID must ideally be configured as a "Single-page application" in Entra ID. Standard refresh-token exchange may fail CORS checks if the token endpoint blocks Origin from web browsers, requiring clear documentation on how the user's App Registration is configured.
6. No secret can be fully protected in a static-only browser app; mitigation is encryption-at-rest, hardening, minimal scopes, and clear documentation.

## References Used to Lock Constraints
1. GitHub Pages is static hosting and does not support server-side languages: https://docs.github.com/en/enterprise-cloud%40latest/pages/getting-started-with-github-pages/creating-a-github-pages-site
2. GitHub Pages static hosting model: https://docs.github.com/en/enterprise-server%403.19/pages/getting-started-with-github-pages/what-is-github-pages
3. Microsoft SPA guidance and CORS/refresh-token constraints: https://learn.microsoft.com/en-us/entra/identity-platform/reference-third-party-cookies-spas
4. Microsoft OAuth auth code/refresh flow details: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
