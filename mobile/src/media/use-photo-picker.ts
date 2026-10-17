import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import type { PickedPhoto } from '@/api/posts';
import { preparePhoto } from '@/media/prepare-photo';

export type PhotoSource = 'camera' | 'library';

export function usePhotoPicker(max: number) {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(source: PhotoSource) {
    setError(null);
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Allow camera access in your phone settings to take a photo.');
        return;
      }
    }

    // No `quality` option: the picker then hands over the file as it is,
    // instead of decoding and saving it once more before preparePhoto runs.
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], exif: false };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync({
            ...options,
            allowsMultipleSelection: true,
            selectionLimit: max - photos.length,
          });
    if (result.canceled) {
      return;
    }

    setPreparing(true);
    try {
      const picked = await Promise.all(result.assets.map((asset) => preparePhoto(asset.uri)));
      setPhotos((current) => [...current, ...picked].slice(0, max));
    } catch {
      setError("One of the photos couldn't be read. Try another one.");
    } finally {
      setPreparing(false);
    }
  }

  function remove(index: number) {
    setPhotos((current) => current.filter((_, at) => at !== index));
  }

  return { photos, preparing, error, max, add, remove };
}

export type PhotoPickerState = ReturnType<typeof usePhotoPicker>;
