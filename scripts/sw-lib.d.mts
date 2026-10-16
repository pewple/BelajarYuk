export function listFiles(dir: string): string[];
export function mediaFilesIn(manifestText: string): string[];
export function versionOf(files: Iterable<[string, string | Uint8Array]>): string;
export function buildServiceWorker(options: { shell: string[]; media: string[]; version: string }): string;
