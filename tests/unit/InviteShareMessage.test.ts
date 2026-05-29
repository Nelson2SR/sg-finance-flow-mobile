/**
 * Tests for buildShareMessage — the share-text formatter that determines
 * whether the invite survives WeChat's preview truncation. Layout is the
 * load-bearing contract here: the code must appear on its OWN labelled
 * line so even a truncated preview retains it, and the message must NOT
 * include a URL today (the sgff.app universal-link domain isn't live —
 * see InviteSheet.tsx header).
 */

import { buildShareMessage } from '../../components/features/InviteSheet';

describe('buildShareMessage', () => {
  const groupName = 'Family Group';
  const code = 'IYJ6NLbVCe7EjpKpLXMMlM1zYB-TURw';

  it('puts the group hook on the first line so it survives any preview', () => {
    const msg = buildShareMessage(groupName, code);
    expect(msg.split('\n')[0]).toBe(`You're invited to "${groupName}" on VaultWise!`);
  });

  it('puts the code on a labelled line of its own (not buried in prose)', () => {
    const msg = buildShareMessage(groupName, code);
    expect(msg).toContain(`\nInvite code: ${code}\n`);
  });

  it('tells the recipient exactly where to paste the code', () => {
    const msg = buildShareMessage(groupName, code);
    expect(msg).toContain('Vault Groups');
    expect(msg).toContain('Have an invite code?');
  });

  it('does NOT include any sgff.app URL (domain not live yet)', () => {
    const msg = buildShareMessage(groupName, code);
    expect(msg).not.toContain('sgff.app');
    expect(msg).not.toContain('http');
  });

  it('handles group names with double quotes without breaking the format', () => {
    const msg = buildShareMessage('Bali "Trip" 2026', code);
    expect(msg.startsWith('You\'re invited to "Bali "Trip" 2026" on VaultWise!')).toBe(true);
    expect(msg).toContain(`Invite code: ${code}`);
  });
});
