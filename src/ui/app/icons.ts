// Every image the designed page uses, in one place. Most are exported from
// Figma (docs/design/assets) and used as-is; icon-settings.svg and the two
// icon-volume-*.svg are ours, drawn in the same style. Imported so Vite bundles them: nothing loads from the
// internet (SPEC 0.2).
import chevronDown from './icons/icon-chevron-down.svg'
import chevronRight from './icons/icon-chevron-right.svg'
import cornerBl from './icons/corner-bl.svg'
import cornerBr from './icons/corner-br.svg'
import cornerTl from './icons/corner-tl.svg'
import cornerTr from './icons/corner-tr.svg'
import download from './icons/icon-download.svg'
import downloadDisabled from './icons/icon-download-disabled.svg'
import logoMark from './icons/logo-mark.svg'
import noteHead from './icons/note-head.svg'
import plus from './icons/icon-plus.svg'
import record from './icons/icon-record.svg'
import settings from './icons/icon-settings.svg'
import tapRipple from './icons/tap-ripple.svg'
import upload from './icons/icon-upload.svg'
import volumeOff from './icons/icon-volume-off.svg'
import volumeOn from './icons/icon-volume-on.svg'

export const ICONS = {
  chevronDown,
  chevronRight,
  cornerBl,
  cornerBr,
  cornerTl,
  cornerTr,
  download,
  downloadDisabled,
  logoMark,
  noteHead,
  plus,
  record,
  settings,
  tapRipple,
  upload,
  volumeOff,
  volumeOn,
}
