# Architecture: Vault Groups

Engineering contract for PRD_10. Two commit boundaries — backend
(PR-5a) and mobile (PR-5b). Backend ships additive first (legacy
`/family/*` routes stay alive aliased), mobile cuts over, then a
PR-5c cleanup removes the aliases.

## 1. Scope

| In scope (PR-5) | Out of scope |
|---|---|
| Rename family schema → vault_groups | Retroactive history backfill on join |
| Multi-group membership per user | E2E-encrypted groups (incompatible with Copilot) |
| Per-transaction `vault_group_id` | Spending limits / owner approvals |
| Universal-link / app-link invites | Push notifications (toast only Phase 1) |
| Avatar stack on Vault card + Activity row | Per-category visibility filters |
| Auto-join after sign-in (pending-invite cache) | Per-group Copilot personas |

## 2. Schema (migration 013)

### 2.1 Renames
```
families                  → vault_groups
family_members            → vault_group_members
invitations               → vault_group_invitations
```

`families.name` already exists. `family_members.role` (`OWNER` | `MEMBER`)
preserved. `invitations.invite_code` (UNIQUE), `family_id`, `created_by`,
`created_at` preserved. Rename is mechanical — no column changes for these
tables in this migration.

### 2.2 `vault_groups` additions
```sql
ALTER TABLE vault_groups
    ADD COLUMN IF NOT EXISTS emoji        TEXT,
    ADD COLUMN IF NOT EXISTS created_by   INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
```

`emoji` is optional cosmetic. `created_by` is denormalised owner pointer
(also derivable from `vault_group_members.role = 'OWNER'`) — cached for
quick reads. NULL allowed during the migration window for legacy rows; a
backfill step in the same migration sets it to the row's owner_member.

### 2.3 `vault_group_invitations` extensions
```sql
ALTER TABLE vault_group_invitations
    ADD COLUMN IF NOT EXISTS expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    ADD COLUMN IF NOT EXISTS consumed_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS consumed_by       INTEGER REFERENCES users(id);
```

A consumed invite becomes immutable evidence ("X joined via invite Y").
Backfill: existing rows get `expires_at = created_at + 7d`, `consumed_at`
NULL.

### 2.4 `transactions.vault_group_id`
```sql
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS vault_group_id INTEGER REFERENCES vault_groups(id);
CREATE INDEX IF NOT EXISTS idx_transactions_vault_group
    ON transactions(vault_group_id);
```

NULL = legacy / no-group transaction (still visible to the author only).
Same column added on `statements`, `categorisation_rules`, `bank_accounts`
in the same migration — every per-user record can be group-scoped.

### 2.5 First-group bootstrap

The migration script seeds a "default" Vault Group for each existing user
(`name = '<display_name>'s Vault'`, `role = OWNER`) and updates all of
their existing transactions/statements/etc to point at it. This avoids the
"all my transactions vanished" UX after migration — every legacy
transaction belongs to a group, just one that happens to be size 1.

## 3. Backend API

All under `/api/v1/groups/`. The legacy `/family/*` routes stay mounted as
aliases (`@router.get("/family/status", deprecated=True, ...)` → calls into
the new handler with the user's default group) for one release cycle.

| Method | Path                                | Purpose |
|--------|--------------------------------------|---------|
| GET    | `/groups`                            | List groups the caller is in |
| POST   | `/groups`                            | Create a new group |
| GET    | `/groups/{id}`                       | Detail (members, role of caller) |
| PATCH  | `/groups/{id}`                       | Rename / change emoji (owner only) |
| DELETE | `/groups/{id}`                       | Delete (owner only) |
| POST   | `/groups/{id}/invite`                | Generate an invite link |
| GET    | `/groups/invitations/{code}`         | Look up an invite (used by app on deep-link open before sign-in) |
| POST   | `/groups/join`                       | Consume an invite code → membership |
| POST   | `/groups/{id}/leave`                 | Leave (owner needs to transfer first) |
| POST   | `/groups/{id}/transfer-ownership`    | Transfer OWNER role to another member |
| DELETE | `/groups/{id}/members/{user_id}`     | Owner-only remove |

### 3.1 Invite contract
```
POST /api/v1/groups/{id}/invite
→ 201 {
    "invite_code": "abc123",
    "expires_at":  "2026-05-22T...",
    "share_url":   "https://sgff.app/invite/abc123"
}

GET /api/v1/groups/invitations/abc123
→ 200 {
    "group": { "id": 7, "name": "Su Rong's Vault", "emoji": "🏡" },
    "inviter": { "display_name": "Su Rong", "avatar_url": "..." },
    "expires_at": "2026-05-22T..."
}
→ 410 GONE if expired/consumed (signed-out app shows "invite no longer
       valid" copy before nuking the cached code).

POST /api/v1/groups/join
  body: { "invite_code": "abc123" }
→ 200 {
    "group": { ... },
    "members": [ ... ]
}
→ 410 GONE if expired/consumed
→ 403 if caller is already in the group
```

### 3.2 Transactions filtering
```
GET /api/v1/transactions?group_id=7&...
```
The route filters `WHERE vault_group_id = %s AND <caller is member of %s>`.
Without `group_id`, returns transactions across **all** groups the caller
belongs to (with `vault_group_id` populated on each row so the mobile
client can group them).

### 3.3 Authorisation
Every group-scoped endpoint checks `vault_group_members WHERE user_id =
<caller> AND vault_group_id = <id>` and 403s on miss. Owner-only endpoints
additionally check `role = 'OWNER'`.

## 4. Mobile Architecture

### 4.1 New store: `useVaultGroupsStore`
```ts
{
  groups: VaultGroup[],
  activeGroupId: number | null,
  pendingInviteCode: string | null,    // captured from a deep link
                                       // before sign-in
  syncFromBackend: () => Promise<void>,
  createGroup: (name, emoji?) => Promise<VaultGroup>,
  setActiveGroup: (id) => void,
  consumePendingInvite: () => Promise<void>,
  inviteMember: (groupId) => Promise<InviteResponse>,
  leaveGroup: (groupId) => Promise<void>,
}
```

### 4.2 Deep-link handler
- `app.json` registers the scheme `sgff://` and the universal-link
  `applinks:sgff.app` (associated domains entry).
- `app/_layout.tsx` listens via `Linking.addEventListener('url', ...)` →
  parses `/invite/{code}` → writes the code into the store's
  `pendingInviteCode`.
- The `AuthContext` reads `pendingInviteCode` after a successful login
  and calls `consumePendingInvite()` before pushing the user into
  `/(tabs)`. On success the new group becomes the active group.

### 4.3 Avatar-stack component
- New `components/features/AvatarStack.tsx` — accepts a list of users +
  max-visible count. Renders overlapping circles, "+N" pill for overflow.
  Used on the home vault card and (smaller) on the group switcher.

### 4.4 Activity row attribution
- Each transaction row's icon circle gets a 16px `AuthorAvatarBadge`
  bottom-right, offset by -3px, only rendered when the active group has
  more than one member. Falls back to initials if the user has no avatar.

### 4.5 Group switcher
- Tap the avatar stack in the home header → bottom-sheet listing all
  groups the user is in. Each row shows name + emoji + avatar stack +
  active checkmark. Bottom of sheet has "Create new group" + active
  group's "Invite members" + "Group settings".

### 4.6 Routes
- `/groups` (sheet, modal presentation) — new-group / invite UI
- `/groups/[id]/settings` — manage group, transfer ownership, remove
  members, leave

## 5. Universal-link / app-link config

iOS: `apple-app-site-association` JSON served from `https://sgff.app/`
with the app's bundle id + paths `["/invite/*"]`. App needs
`Associated Domains = applinks:sgff.app` capability in the entitlements.

Android: `assetlinks.json` served from same host + app's package /
SHA-256 fingerprint. `intent-filter` with `autoVerify=true`.

Both ship as part of an EAS dev build (PR-5b prereq). Until then the
fallback is the custom `sgff://invite/{code}` scheme which only opens
the app on the same device that registered it (no cross-device clipboard
trickery needed for dev).

## 6. Migration Sequence

| PR | What | Risk |
|----|------|------|
| PR-5a backend | Migration 013 (rename + add `vault_group_id` + bootstrap), new `/groups/*` routes, legacy `/family/*` aliased | Medium — schema rename touches existing data; bootstrap script must be idempotent |
| PR-5b mobile | New store + Vault Groups UI + deep-link handling + auto-join | Medium — universal-link config + EAS dev build |
| PR-5c cleanup | Delete `/family/*` aliases, drop the `family_*` table aliases (if any introspection kept them) | Low — removal only |

## 7. Threat Model

| Threat | Mitigation |
|---|---|
| Stolen invite link reused | Single-use code + 7d expiry + 410 on second consume |
| Invite link shared with too many people | Per-invite "scoped to phone/openid" optional field (Phase 1.1) |
| Member exfiltrates group data after being removed | All transactions stay visible to the *author* even after removal. Removed member loses read access to other members' rows immediately on the next request — `vault_group_members` row gone → 403. |
| Owner kicks themselves out | OWNER cannot Leave directly; must Transfer or Delete |
| Bulk-create groups to inflate share metrics | Rate limit `POST /groups` to 10/day per user (out of Phase 1 scope; doc only) |

## 8. Open Questions

1. **Email/SMS in the invite link?** The current design ships the link
   through the user's choice of messenger. Should we also support
   server-side email or SMS dispatch? **Decision**: not in Phase 1 —
   adds SES/SMS provider integration that doesn't earn its keep yet.
2. **What happens to a member's transactions when they leave?** Current
   design: they keep ownership (their `user_id` stays on the rows) but
   the rows lose visibility to the remaining group. Some apps prefer
   "the data stays with the group" — call out in onboarding copy.
3. **Default group name?** Bootstrap uses `<display_name>'s Vault`.
   When display_name is null (phone-only sign-in), fall back to
   `My Vault` and let the user rename.
4. **Avatar source for phone-only users?** No upstream provider returns
   an avatar URL for phone-OTP users. Use initials-on-tinted-circle from
   the existing `categoryStyle` palette, hash-keyed on user_id so each
   user has a stable distinct color.

## 9. References
- PRD_10_Vault_Groups.md (product side of this doc)
- PRD_09_Auth.md (identity model — `identity_links` is the basis for
  invite addressing in a future scope)
- ARCH_AUTH.md (token + user model)
- Existing `data/migrations/004_add_family_sharing_pg.sql` (the schema
  this migration renames)
- Existing `api/routes/family.py` (the legacy routes this PR aliases
  then deprecates)
