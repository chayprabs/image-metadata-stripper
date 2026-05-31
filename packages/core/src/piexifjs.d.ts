declare module "piexifjs" {
  export interface IExif {
    "0th": Record<number, unknown>;
    Exif: Record<number, unknown>;
    GPS: Record<number, unknown>;
    "1st": Record<number, unknown>;
    thumbnail: string | null;
  }
  export const ImageIFD: Record<string, number>;
  export const ExifIFD: Record<string, number>;
  export function load(dataUrl: string): IExif;
  export function dump(exifObj: IExif): string;
  export function insert(exifBytes: string, dataUrl: string): string;
  export function remove(dataUrl: string): string;
}

declare module "png-chunks-extract" {
  export default function extractChunks(data: Uint8Array): { name: string; data: Uint8Array }[];
}

declare module "png-chunks-encode" {
  export default function encodeChunks(
    chunks: { name: string; data: Uint8Array }[]
  ): Uint8Array;
}
