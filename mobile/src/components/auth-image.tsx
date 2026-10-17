import { Image, type ImageStyle } from 'expo-image';
import { useEffect } from 'react';
import type { StyleProp } from 'react-native';

import { refreshSession } from '@/api/client';
import { accessTokenExpired } from '@/session/tokens';
import { useAccessToken } from '@/session/use-access-token';

interface AuthImageProps {
  uri: string;
  style: StyleProp<ImageStyle>;
  accessibilityLabel: string;
}

/** Photos are behind the sign-in check, so the request carries the access token. */
export function AuthImage({ uri, style, accessibilityLabel }: AuthImageProps) {
  const token = useAccessToken();

  useEffect(() => {
    if (accessTokenExpired()) {
      void refreshSession();
    }
  }, [token]);

  return (
    <Image
      source={{ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
      style={style}
      contentFit="cover"
      cachePolicy="memory"
      accessibilityLabel={accessibilityLabel}
    />
  );
}
