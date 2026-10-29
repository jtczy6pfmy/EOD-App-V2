# Single-user Dropbox connection

EOD V2 is Harrisburg-only. Existing daily data keys and Supabase report tables are unchanged. The original worksheet is `/McMullenAaron/Tire Audit Worksheet Aaron McMullen.xlsx`. The verified Dropbox file ID is retained after connection, so moving or renaming it does not select a different workbook.

## One-time setup

1. In https://www.dropbox.com/developers/apps create a **Scoped access / Full Dropbox** app for EOD V2. Full Dropbox is necessary to access the existing workbook outside an app folder. Enable `account_info.read`, `files.metadata.read`, `files.content.read`, `files.content.write`. Enable public clients / PKCE; implicit grant is not used.
2. Register this exact redirect: `https://jtczy6pfmy.github.io/EOD-App-V2/dropbox-callback.html`.
3. The supplied public Dropbox App key is configured in the function. `DROPBOX_APP_KEY` may optionally override it. No App secret is needed with PKCE. Set these private Supabase Edge Function secrets (never commit their values):
   - `DROPBOX_OWNER_ACCOUNT_ID`: your Dropbox `account_id` (`dbid:…`), obtained using Dropbox's API Explorer `users/get_current_account` while signed into your own account. This is an explicit allowlist; the first visitor cannot claim ownership.
   - `DROPBOX_TOKEN_ENCRYPTION_KEY`: a random 32-byte key encoded as base64. Keep this key stable; changing it requires reconnecting Dropbox.
4. Run `setup.sql` in the eod-app project. Deploy `supabase/functions/eod-dropbox/index.ts` and `handler.mjs` as `eod-dropbox` with `verify_jwt=false`. The function authenticates requests itself with Dropbox identity and opaque, expiring sessions. All other functions retain their current settings.
5. Open Tire Audits in EOD V2 and select **Connect Dropbox**. Only the configured owner account can connect. Verify the workbook name after returning.

Dropbox refresh tokens are encrypted with AES-256-GCM in a database table denied to `anon` and `authenticated`. The encryption key stays in Edge Function secrets. Dropbox access tokens never leave the server. Only the SHA-256 hash of the app's random session token is stored server-side; that session expires after 30 days. Signing in on another device uses the same Dropbox account without a second EOD password. Disconnect revokes Dropbox authorization and removes the stored connection and sessions.

## Scope of this change

This adds secure connection storage, access verification, an authenticated download endpoint returning the original workbook bytes, and a dedicated Tire Audits page with the existing manual audit controls. It does **not** yet edit/upload the workbook, import historical rows into EOD, or infer its uninspected columns/formulas. An upload endpoint must wait for workbook inspection and preservation tests and must use the Dropbox revision to reject concurrent edits. The requested read/write scope is reserved for that follow-up.

No credentials belong in `eod_daily`, local report snapshots, GitHub source, or a public configuration file. The client stores only the scoped EOD connection session, not Dropbox tokens/passwords. Avoid third-party scripts on the callback page.

## Validation

Run `node --test tests/*.test.mjs`. Live Dropbox sign-in and original-workbook verification require completing the one-time setup; mock tests do not establish live connectivity.
