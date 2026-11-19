export const DEFAULT_READER_TYPE: ReaderType = { width: 'default', leading: 'default', face: 'sans', sepia: false }

/** The paper colour a message is set on when Sepia is on: mail HTML is written for a light sheet, so it is light in dark mode too */
export const SEPIA_PAPER = '#f7f0e1'

/** How messages are set in the reader, chosen in its "Aa" menu and kept on this computer */
export function useReaderType() {
  return useLocalPref<ReaderType>('reader-type', DEFAULT_READER_TYPE)
}
