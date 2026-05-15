import React from 'react';
import { Text, View } from 'react-native';
import { Image } from 'react-native';

import { resolveLabelColor, tintWithAlpha } from '../../lib/categoryStyle';

export interface AvatarStackMember {
  user_id: number;
  display_name: string | null;
  avatar_url?: string | null;
}

interface AvatarStackProps {
  members: AvatarStackMember[];
  /** Max number of avatars to render before collapsing to a "+N" pill. */
  maxVisible?: number;
  /** Pixel diameter of each avatar circle. */
  size?: number;
  /** Pixels each subsequent avatar is shifted left by, for the overlap effect. */
  overlap?: number;
  /** Optional accent for the surrounding ring; defaults to the surface ring color. */
  ringColor?: string;
}

/**
 * Overlapping circular avatars — the home vault card uses this to
 * advertise a Vault Group's membership at a glance.
 *
 * Phone-only users have no avatar URL; we render their initials on a
 * deterministic tinted circle (hash-keyed on user_id via the shared
 * categoryStyle palette so the same user always looks the same).
 *
 * For overflow beyond ``maxVisible``, render a single "+N" pill at the
 * end of the stack. Pass ``members.length === 1`` and the stack
 * degenerates to a single avatar — useful so callers don't have to
 * branch on solo groups.
 */
export function AvatarStack({
  members,
  maxVisible = 4,
  size = 32,
  overlap = 10,
  ringColor = '#ffffff',
}: AvatarStackProps) {
  if (members.length === 0) return null;

  const visible = members.slice(0, maxVisible);
  const overflow = Math.max(0, members.length - maxVisible);

  return (
    <View className="flex-row items-center">
      {visible.map((m, i) => (
        <View
          key={m.user_id}
          style={{
            marginLeft: i === 0 ? 0 : -overlap,
            zIndex: visible.length - i,
          }}>
          <AvatarCircle member={m} size={size} ringColor={ringColor} />
        </View>
      ))}
      {overflow > 0 && (
        <View
          className="justify-center items-center bg-surface-3"
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            marginLeft: -overlap,
            borderWidth: 2,
            borderColor: ringColor,
          }}>
          <Text className="font-jakarta-bold text-text-mid text-[10px]">
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Single circular avatar — exported so callers (Activity row author
 * badges) can use it without the wrapping stack.
 */
export function AvatarCircle({
  member,
  size = 32,
  ringColor = '#ffffff',
}: {
  member: AvatarStackMember;
  size?: number;
  ringColor?: string;
}) {
  const tint = resolveLabelColor(String(member.user_id));
  const initials = computeInitials(member.display_name);

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: ringColor,
  } as const;

  if (member.avatar_url) {
    return (
      <Image
        source={{ uri: member.avatar_url }}
        style={baseStyle}
      />
    );
  }

  return (
    <View
      className="justify-center items-center"
      style={{
        ...baseStyle,
        backgroundColor: tintWithAlpha(tint, 0.9),
      }}>
      <Text
        className="font-jakarta-bold text-white"
        style={{ fontSize: Math.max(10, size * 0.42) }}>
        {initials}
      </Text>
    </View>
  );
}

function computeInitials(displayName: string | null): string {
  if (!displayName) return '?';
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
