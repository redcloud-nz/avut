# Spec: Database encryption key versioning and rotation

**Date:** 2026-09-29
**Status:** Draft

Give encrypted database values a versioned, key-identified format, so that
`DB_ENCRYPTION_SECRET` can be rotated without downtime or data loss. The same
change binds each ciphertext to the row it belongs to.

Builds on the `ProviderCredential` table introduced on `feat/provider-credential`
(#286). Today that table's `token` column is the only encrypted value in the
database.

---

## 1. The problem

`src/server/encrypt.ts` encrypts with AES-256-GCM, a random 12-byte IV and a
16-byte tag, and stores `base64(iv | ciphertext | tag)`. The construction is
sound. The key management around it is not:

1. **Rotation is impossible.** A stored value doesn't record which key encrypted
   it, and only one key is ever loaded. Changing `DB_ENCRYPTION_SECRET` makes
   every existing credential undecryptable at once. The only recovery is for
   every user and organization to re-enter their D4H tokens.
2. **The key is weaker than it looks.** `DB_ENCRYPTION_SECRET` is a 32-_character_
   string used directly as key bytes. If it was generated as 32 hex characters
   it carries 128 bits of entropy, not 256. A non-ASCII character makes it
   longer than 32 bytes, and it then fails at runtime rather than at startup.
3. **Ciphertext isn't bound to its row.** With database write access, you can
   copy one row's `token` into another row, or change a row's owner columns,
   and the value still decrypts. For example, an organization's token could be
   moved under a personal credential.
4. **The tag length isn't pinned.** `decryptValue` passes no `authTagLength` to
   `createDecipheriv` and doesn't check input length. Truncated input produces a
   short tag, which Node accepts with only a deprecation warning (DEP0182).

Problems 3 and 4 need database write access to exploit, so they matter less.
Fixing them now is cheap because the format is changing anyway.

### Call sites

Every encrypted value goes through two functions:

| Site                                                                    | Operation |
| ----------------------------------------------------------------------- | --------- |
| `d4h-access-tokens-router.ts` — `createOrganizationAccessToken`         | encrypt   |
| `d4h-access-tokens-router.ts` — `createPersonalAccessToken`             | encrypt   |
| `d4h-access-tokens-router.ts` — `getPersonalAccessToken` (health check) | decrypt   |
| `src/server/provider-credential.ts` — `toServerOnlyProviderCredential`  | decrypt   |

---

## 2. Goals and non-goals

**Goals**

- Several keys can be loaded at once. New values are written with the current
  key, and each existing value decrypts with the key it names.
- Rotation happens without downtime, and every Vercel deployment that can be
  live or rolled back to during the process can read every row.
- Each ciphertext is bound to its row's identity and owner.
- The key material has a fixed format of 32 random bytes, checked when the
  keyring loads.
- Rows written before this change keep working until they are re-encrypted.

**Non-goals**

- **Envelope encryption or a managed KMS.** Vercel KMS offers signing keys, not
  encryption keys. An external KMS (AWS KMS, GCP KMS) would be a bigger change
  than the problem warrants at current scale. The format below leaves room for
  it: a key ID could later name a wrapped data key.
- **Per-organization keys.** There is one keyring per deployment environment.
- **Encrypting anything other than `ProviderCredential.token`.** The API is
  general, but moving other columns onto it is separate work.

---

## 3. Design

### 3.1 Key material and environment variables

```
DB_ENCRYPTION_KEYS="k2:<base64>,k1:<base64>"
DB_ENCRYPTION_KEY_CURRENT="k2"
DB_ENCRYPTION_SECRET="<legacy 32-character string>"   # only until the legacy rows are gone
```

- **`DB_ENCRYPTION_KEYS`** is a comma-separated list of `<keyId>:<key>` entries.
  - The key ID matches `^[a-z0-9]{1,16}$`. The convention is `k1`, `k2`, … in
    rotation order, but nothing depends on the order.
  - The key is standard base64 that must decode to exactly 32 bytes. Generate it
    with `openssl rand -base64 32`.
  - Duplicate IDs are an error.
- **`DB_ENCRYPTION_KEY_CURRENT`** names the key used to encrypt new values. It
  must be present in `DB_ENCRYPTION_KEYS`. If it is unset, new values are
  written in the legacy format (§3.5). That is deliberate: it is the "can read
  v2, still writes legacy" state rollout needs.
- **`DB_ENCRYPTION_SECRET`** stays as the legacy key, used only to decrypt
  unprefixed values. It keeps its current interpretation, a 32-character string
  whose UTF-8 bytes are the key.
- Each Vercel environment (Production, Preview, Development) gets its own keys.
  The production keys never appear in Preview, in Development or in any
  `.env.local`.

**Keyring loading.** A new `getKeyring()` in `encrypt.ts` parses these variables
lazily and memoizes the result. It follows `serverEnv`'s getter pattern, so
importing the module never throws. Parsing is all-or-nothing: any malformed
entry throws an error naming the variable and the entry's position, never its
value. A partially loaded keyring could silently mis-encrypt, so it isn't
allowed.

### 3.2 Stored format

```
v2.<keyId>.<base64(iv[12] | ciphertext | tag[16])>
```

- `.` is the separator because it can't appear in a key ID or in standard base64.
- A value beginning `v2.` is v2. Any other value is legacy, because legacy
  base64 can never contain `.`.
- The `v2` version marker describes the whole construction: algorithm, IV and
  tag layout, and how the additional authenticated data (AAD, §3.3) is encoded.
  Changing any of these means a `v3`, not a new key ID.
- Decryption creates the decipher with `{ authTagLength: 16 }` and rejects any
  payload shorter than 28 bytes before touching the cipher. The legacy path
  gets the same two checks.

### 3.3 Binding ciphertext to its row

v2 values are encrypted with AAD. GCM authenticates the AAD without storing it,
so decryption fails if the AAD supplied doesn't match the AAD used at
encryption.

```ts
type EncryptionContext = {
  purpose: "provider-credential";
  id: string;
  provider: Provider;
  organizationId: string | null;
  userId: string | null;
  groupId: string | null;
};
```

The AAD is `JSON.stringify` of the context, with keys in exactly the order
declared above. Serialization lives in one function, `encodeAad(context)`, with
a unit test pinning its exact output. Reordering the keys would silently break
every row.

**What goes in the AAD, and why:**

- **`purpose`** namespaces future encrypted columns, so a value can't be moved
  from one kind of column to another.
- **`id`** stops ciphertext being swapped between rows.
- **The owner columns** stop a row's owner being changed while its ciphertext
  still decrypts. The cost is that a credential's owner can never change
  without re-encrypting it. No operation today changes an owner, and a future
  one would re-encrypt as part of the change.
- **`provider`** is already implied by `id`. Including it costs nothing and
  documents intent.
- **What's left out:** `label`, `status` and `metadata` are mutable and carry
  no authority.

Legacy values have no AAD, and the legacy path ignores the context.

### 3.4 API

```ts
// src/server/encrypt.ts
export function encryptDBValue(plaintext: string, context: EncryptionContext): string;
export function decryptDBValue(stored: string, context: EncryptionContext): string;
export function storedKeyId(stored: string): string | "legacy";
```

- **Required context.** Both functions take `context`, so no call site can
  forget it. `encryptValue` and `decryptValue`, the raw primitives, gain an
  optional `aad: Buffer` parameter and are no longer exported outside `encrypt.ts`
  and its tests.
- **Deriving the context.** Callers get it from
  `providerCredentialContext(record)` in `src/server/provider-credential.ts`,
  which picks the fields from a `ProviderCredentialRecord` or a create input.
- **Create mutations.** Both already know `tokenId` and the owner before they
  encrypt, so they pass the same values they write to the row.
- **Errors.** Decryption failures throw a single `DecryptionError` whose message
  names the key ID and credential ID. It never includes ciphertext or plaintext.
  An unknown key ID and an authentication failure are separate `reason` values,
  because they need different fixes.

### 3.5 Legacy values

- An unprefixed value decrypts with `DB_ENCRYPTION_SECRET` and no AAD.
- `encryptDBValue` writes legacy only while `DB_ENCRYPTION_KEY_CURRENT` is unset.
- `DB_ENCRYPTION_SECRET` becomes optional once no legacy rows remain. If it is
  unset and a legacy value turns up, decryption throws `DecryptionError` with
  reason `unknown-key`.
- The legacy path is deleted in a follow-up once production has zero legacy
  rows, after one release cycle.

### 3.6 Caching

`fetchProviderCredential` caches `ProviderCredential` records, ciphertext
included, with `"use cache"`. After a row is re-encrypted, a cached copy may
still hold the old ciphertext, and it needs the old key until the entry is
refreshed. For that reason:

- Re-encryption (§4) calls `revalidateProviderCredential(id)`, and for personal
  credentials `revalidatePersonalProviderCredential(...)`, for every row it
  rewrites.
- This spec depends on the review fix that makes the personal-credential cache
  hold the _record_ rather than the decrypted plaintext. Otherwise rotation
  would leave plaintext in the cache under the old entry, and nothing would
  re-encrypt it.

---

## 4. Re-encryption

Re-encryption is a **system-admin tRPC mutation**, `system.reencryptCredentials`,
gated on `systemAdminProcedure`, with a matching control on a system-admin page.

```ts
input: {
  dryRun: boolean;
}
output: {
  byKeyBefore: Record<string, number>; // "legacy" | keyId → row count
  rewritten: number;
  skipped: number; // concurrent change; picked up on the next run
  failed: {
    id: string;
    reason: DecryptionError["reason"];
  }
  [];
  byKeyAfter: Record<string, number>;
}
```

**Behaviour:**

1. Load every `ProviderCredential` whose `storedKeyId(token)` isn't the current
   key.
2. For each row, decrypt with its own key, then encrypt with the current key and
   the row's context.
3. Write each row with a conditional update:
   `updateMany({ where: { id, token: <old ciphertext> }, data: { token: <new> } })`.
   A count of 0 means the row changed concurrently. It is counted as skipped,
   and the next run picks it up.
4. Rows are handled one at a time, each with its own conditional update rather
   than one transaction for the whole run. One bad row doesn't stop the others,
   and a partial run is safe to repeat.
5. Revalidate each rewritten row's cache tags (§3.6).
6. Log a single `ctx.logSystemEvent` summarizing the run, with counts by key
   before and after and the IDs of failed rows. A key ID change isn't
   user-meaningful, so there is no event per row.
7. With `dryRun`, do only step 1 and report the counts.

**Why a mutation and not a script:** the job needs the database URL and the old
and new keys for the target environment. Running it inside the deployment
uses that deployment's own environment. A script would need production secrets
pulled onto a laptop with `vercel env pull`, which is exactly the exposure
rotation is meant to limit. It also puts the run through the normal
`logSystemEvent` audit path, which scripts can't reach under the "log rows only
via `ctx.logEvent`" rule.

The same page shows the dry-run counts. That doubles as the verification step
of the runbook.

---

## 5. Rotation runbook

Run this per environment. Production is the one that matters, but practise on
Preview first.

| Step | Action                                                                       | Deploy? | Why                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Generate `k(n+1)`; add it to `DB_ENCRYPTION_KEYS`; leave `CURRENT` unchanged | Yes     | Every live deployment can now _read_ the new key before anything _writes_ it.                                                                    |
| 2    | Set `DB_ENCRYPTION_KEY_CURRENT=k(n+1)`                                       | Yes     | New and refreshed credentials use the new key.                                                                                                   |
| 3    | System admin → _Re-encrypt credentials_, dry run, then for real              | No      | Moves existing rows onto the new key.                                                                                                            |
| 4    | Dry run again; confirm every row is on `k(n+1)` and nothing failed           | No      | Verification.                                                                                                                                    |
| 5    | Remove `k(n)` from `DB_ENCRYPTION_KEYS`                                      | Yes     | Retires the old key. Wait until nothing needs to roll back to a deployment from before step 2, since those deployments can't read `k(n+1)` rows. |

**Steps 1 and 2 must be separate deploys.** A Vercel deployment keeps the
environment it was built with. Between steps 1 and 2, some instances may be
running the previous deployment, and instant rollback can bring back any
earlier one. Neither has `k(n+1)`, so writing with it before every live
deployment can read it would make those rows unreadable there.

**Old deployments after step 5.** A deployment that is live after step 5 but
predates step 1 is the mirror case: it can't read the new rows. Keep the
rollback window in mind at step 5, not step 1.

**First rollout of this spec** uses the same shape, with the legacy key as `k(n)`:

1. Deploy the v2 code with `DB_ENCRYPTION_KEYS="k1:<new>"`, `CURRENT` unset and
   `DB_ENCRYPTION_SECRET` unchanged. The deployment reads everything and still
   writes legacy.
2. Set `CURRENT=k1` and redeploy.
3. Re-encrypt, which moves every legacy row onto `k1`.
4. Verify that zero legacy rows remain.
5. Remove `DB_ENCRYPTION_SECRET` and redeploy. The legacy path is deleted in a
   later release (§3.5).

**Development.** The shared dev database and every worktree use one Development
keyring through `.env.local`. Rotating it follows the same steps, with
"redeploy" meaning restarting the dev servers after updating `.env.local`. The
re-encryption mutation writes to the shared database, so it needs explicit
permission each run, like any other database-changing command.

### If a key leaks

Run the runbook back to back, then **revoke and re-issue the provider tokens
themselves**. Rotation protects only future copies of the database. Anyone
holding the leaked key and any existing dump or backup can decrypt every
credential in it. For D4H, that means revoking each token in D4H, then entering
the replacement in AVUT.

---

## 6. Testing

- `encodeAad`: a fixed context produces an exact expected string. This pins the
  key order.
- A value round-trips with the right context and fails with `reason: "auth"`
  when any context field differs, for each field.
- A value from key `k1` decrypts after rotation to `k2` while `k1` is still in
  the ring, and fails with `reason: "unknown-key"` once it is removed.
- A legacy fixture value, produced by the current `encryptValue`, still
  decrypts. `encryptDBValue` writes legacy when `CURRENT` is unset.
- Rejection cases:
  - truncated payloads (under 28 bytes)
  - a v2 value with its tag truncated
  - malformed keyring entries: bad ID, wrong length, duplicate ID
  - `CURRENT` naming a key that isn't in the ring
- Error messages never contain key material, ciphertext or plaintext. Assert
  against the test fixtures' values.
- `reencryptCredentials` in prisma-mock:
  - Dry run reports counts and writes nothing.
  - A real run rewrites only the rows not on the current key.
  - A row whose `token` changes between read and write is counted as skipped.
  - One corrupt row lands in `failed` without stopping the others.
  - Exactly one system log entry is written per run.

---

## 7. Risks

| Risk                                                                    | Mitigation                                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `CURRENT` is switched before every live deployment can read the new key | Separate-deploy rule (§5). The runbook table states why.                          |
| AAD serialization drifts, so every row fails authentication             | One `encodeAad`, with an exact-output test.                                       |
| A key is removed while cached records still carry its ciphertext        | Re-encryption revalidates cache tags (§3.6). Verify with a dry run before step 5. |
| Keyring parse error takes down every credential-reading path            | Fail loudly with the variable name. Preview gets the change first.                |
| Owner binding blocks a future "transfer credential" feature             | That feature re-encrypts as part of the transfer. Noted in §3.3.                  |

---

## 8. Order

1. Prerequisite review fixes on `feat/provider-credential`: cache the record,
   not plaintext; revalidate on delete.
2. `encrypt.ts`: keyring, v2 format, AAD, `DecryptionError`, legacy path, plus
   tests.
3. `providerCredentialContext` and the four call sites.
4. `system.reencryptCredentials` and its system-admin page control.
5. Runbook copied into `docs/` as a standalone operator page, linked from
   `docs/releasing.md`.
6. First rollout (§5) on Preview, then Production.
7. One release later: delete the legacy path and `DB_ENCRYPTION_SECRET`.

---

## 9. Decisions

| Question               | Decision                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Where keys live        | Vercel environment variables, one keyring per environment. No external KMS for now.                            |
| Keyring shape          | One `DB_ENCRYPTION_KEYS` list plus `DB_ENCRYPTION_KEY_CURRENT`, not one variable per key.                      |
| Key format             | Base64 of exactly 32 random bytes, checked when the keyring loads.                                             |
| Stored format          | `v2.<keyId>.<base64(iv\|ct\|tag)>`. Unprefixed means legacy.                                                   |
| What `v2` versions     | The construction: algorithm, layout and AAD encoding. Key changes use a new key ID, not a new version.         |
| AAD contents           | Purpose, credential ID, provider and all three owner columns.                                                  |
| Unset `CURRENT`        | Write legacy. This gives the safe first-rollout state.                                                         |
| How re-encryption runs | A system-admin tRPC mutation inside the deployment, not a local script, so no production secrets leave Vercel. |
| Audit granularity      | One system event per re-encryption run.                                                                        |
| Tag length             | Pinned to 16 on both the v2 and legacy paths, with a minimum payload length.                                   |
| Leaked key             | Rotate the key and revoke and re-issue the provider tokens. Rotation alone isn't enough.                       |
