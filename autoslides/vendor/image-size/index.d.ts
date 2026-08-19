export interface ImageInfo {
  width: number
  height: number
  type?: string
}

export function imageSize(input: Uint8Array | string): ImageInfo
export function imageSize(
  input: string,
  callback: (err: Error | null, size?: ImageInfo) => void,
): void
export function disableFS(value: boolean): void
export function disableTypes(types: string[]): void
export function setConcurrency(concurrency: number): void
export const types: string[]

export default imageSize
