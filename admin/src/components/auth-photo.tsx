import { useEffect, useState } from 'react';

import { photoBlob } from '@/api/client';

/** The photo students see; it needs the access token, so an <img src> can't load it directly. */
export function AuthPhoto({ photoId, alt }: { photoId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;
    photoBlob(photoId)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setUrl(objectUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoId]);

  return url ? <img src={url} alt={alt} /> : <img alt={alt} />;
}
