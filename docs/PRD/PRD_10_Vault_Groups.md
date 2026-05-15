# PRD 10: Vault Groups

## 1. The Big Idea
**"Invite, see together, never compromise on attribution."**

A Vault Group lets two or more users share a single view of their financial
activity. After joining, every member sees every other member's transactions
in real time, each row stamped with the author's avatar. Inviting is one tap
that produces a link the recipient can open from any messenger — if they
don't have an account yet, they sign in with WeChat or phone, the invite is
consumed automatically, and they land inside the group on first launch.

A user can belong to **multiple** Vault Groups (e.g. one with a partner, one
with parents) and switch between them like switching workspaces. Each group
is a distinct activity view; personal transactions are always tied to a
group too — there is no "personal vault" mode, because the single-user case
is just a Vault Group with one member.

## 2. Diagnostics (What Kills Shared-Money Apps?)
- **Identity ambiguity.** "Who bought the groceries?" If every transaction
  is faceless, the group dynamic breaks down within a week.
- **Friction onboarding the second user.** If the invitee has to download
  the app, sign up, find the invite, and then somehow join the group, the
  drop-off is ≥50%. The right flow is one tap on a link → app opens →
  WeChat/phone sign-in → already in the group.
- **Surprise sharing.** A user who is invited and joins should never wonder
  "wait, what did they see?" Backfill semantics must be transparent and
  consented.
- **Lock-in.** A user must be able to leave a group or remove a member
  without nuking the data — their transactions stay theirs.

## 3. Killer Interaction (The Signature)
**"The Avatar Stack."**

The vault card on the home screen shows a horizontally-stacked row of member
avatars (up to 4 visible, "+N" for more), with the active member's avatar
slightly larger and centered. Tapping it opens the member roster sheet. Each
Activity row carries a tiny circular avatar of the authoring member in the
corner — gone are the days of "is that mine or his?" at a glance.

When inviting, the user gets a single share sheet: link + QR + native share
button. Pasting the link into WeChat / iMessage / WhatsApp opens the app on
the recipient's device (universal links / app links), and the invite is
auto-applied after a successful sign-in. No invite-code-paste step.

## 4. Feature Requirements

### 4.1 Group lifecycle
- **Create**: any user can spin up a new Vault Group with a name and an
  optional emoji. They become the OWNER.
- **Invite**: every member can generate an invite link. Each invitation is
  one-time-use, scoped to a single phone number / WeChat openid, and
  expires after 7 days.
- **Join**: tapping a link launches the app, prompts sign-in if not
  authenticated, consumes the code on successful auth, drops the user
  inside the group. The owner is notified.
- **Leave**: a member can leave at any time. Their transactions stay in
  their personal record but are no longer visible to the group. OWNER
  cannot leave without first transferring ownership.
- **Remove member**: owner-only. Same visibility rules as Leave.
- **Delete group**: owner-only. Detaches all members; their personal
  transactions stay intact.

### 4.2 Multi-group switching
- The home tab header shows the active group's name + avatar stack. A long-
  press (or a dedicated "switch" icon) opens a sheet listing all groups the
  user is in. Selecting one updates `activeGroupId` and refreshes Activity.
- The selector also has a "Create new group" CTA at the bottom.

### 4.3 Transaction visibility
- A transaction is **owned by its author** (`user_id`) and **scoped to one
  group** (`vault_group_id`).
- Activity in the active group = all transactions where `vault_group_id`
  matches the active group, regardless of author.
- When a user joins a group, **only transactions logged in the active group
  during the join window forward are visible** — no retroactive backfill.
  Pre-existing transactions in the joiner's previous group(s) stay there.
- This is the simpler privacy story; pre-join data is invisible to
  new members. A future PRD can add an explicit "import history into this
  group" action if users ask for it.

### 4.4 Member avatars on activity
- Each Activity row, in addition to the category icon and merchant text,
  carries a small circular avatar (16-20px) of the authoring member in the
  bottom-right corner of the icon circle, partially overlapping it. Solo
  Vault Groups (member count = 1) suppress the badge — no clutter when
  there's no ambiguity.

### 4.5 Auto-join after sign-in
- The mobile app listens for `/invite/{code}` universal links.
- If the user taps an invite link while signed in → POST `/groups/join`
  immediately → success toast → land inside the group.
- If the user is signed out → link payload is stashed in
  `expo-secure-store` → standard WeChat/phone OTP login → on successful
  auth, the AuthContext checks for a pending invite, consumes it, then
  routes to `/(tabs)` with the new group active.

### 4.6 Notifications (Phase 1.1, light)
- An invited user is greeted with a confirmation card the first time they
  open the group: "You joined **<Group name>**, invited by **<Owner>**."
- The owner sees a single toast next time they open the app: "<Member>
  joined the group."
- Push notifications are out of scope for Phase 1.

## 5. Out of Scope (Deferred)
- **Retroactive history import** — explicit user-triggered backfill of
  pre-join transactions, with a confirmation step.
- **Spending limits / approvals** — "$X requires owner approval" workflows.
- **Per-category visibility** — a member's category being shareable while
  another is private.
- **Audit log** — a per-group ledger of joins, leaves, removes, ownership
  transfers.
- **End-to-end-encrypted groups** — incompatible with server-side
  categorization that powers Copilot. See PRD_09 §5.
- **Push notifications** — invite/join events are toast-only for now.

## 6. Success Metrics
- **Time from inviter sending link → invitee inside group**: ≤ 60 seconds
  on a fresh install (download + open + sign-in + join).
- **Invite-link conversion rate** (links sent → accepted joins) ≥ 50%.
- **Group activity attribution clarity**: in user testing, 100% of
  participants correctly identify who logged each transaction at a glance.
- **Zero accidental data leaks**: pre-join transactions never surface in a
  group view they shouldn't (covered by integration tests).
