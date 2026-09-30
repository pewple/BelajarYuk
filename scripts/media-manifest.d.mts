export const AUDIO_EXTENSIONS: string[];
export const IMAGE_EXTENSIONS: string[];
export function renderManifest(audio: string[], images: string[]): string;
export function writeManifest(mediaDir: string): {
  audio: string[];
  images: string[];
  ignored: string[];
};
