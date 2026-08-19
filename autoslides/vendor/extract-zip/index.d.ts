import { Entry, ZipFile } from 'yauzl'

declare namespace extract {
  interface Options {
    dir: string
    defaultDirMode?: number
    defaultFileMode?: number
    onEntry?: (entry: Entry, zipfile: ZipFile) => void
  }
}

declare function extract(
  zipPath: string,
  opts: extract.Options,
): Promise<void>

export = extract
