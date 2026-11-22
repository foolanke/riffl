// Load a project file and start a new project (SPEC step 18). Download stays
// in the sidebar footer.
import { useEffect, useRef, useState } from 'react'
import { loadProjectFile, startNewProject } from '../../../project/saveLoad.ts'
import { OutlineButton } from '../components/OutlineButton.tsx'
import { ICONS } from '../icons.ts'
import { SettingsNote } from './SettingsRow.tsx'

const NEW_PROJECT_CONFIRM_MS = 3000 // the "sure?" state resets after this

export function ProjectFileSettings(props: { disabled: boolean }) {
  const [message, setMessage] = useState('')
  const [confirmingNew, setConfirmingNew] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // "Sure? Click again" falls back to normal after a few seconds.
  useEffect(
    function () {
      if (!confirmingNew) {
        return
      }
      const timer = window.setTimeout(function () {
        setConfirmingNew(false)
      }, NEW_PROJECT_CONFIRM_MS)
      return function () {
        window.clearTimeout(timer)
      }
    },
    [confirmingNew],
  )

  async function handleFileChosen(file: File | undefined) {
    if (!file) {
      return
    }
    try {
      await loadProjectFile(file)
      setMessage('Loaded ' + file.name)
    } catch (error) {
      setMessage('Could not load that file: ' + String(error))
    }
  }

  function handleNewProject() {
    // Two clicks instead of a browser dialog, so the demo never shows one.
    if (!confirmingNew) {
      setConfirmingNew(true)
      return
    }
    setConfirmingNew(false)
    startNewProject()
    setMessage('New project started.')
  }

  return (
    <>
      <input
        ref={fileInputRef}
        className="settings-file-input"
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          handleFileChosen(event.target.files?.[0])
          event.target.value = '' // so the same file can be loaded again
        }}
      />
      <OutlineButton
        className="settings-button"
        icon={ICONS.upload}
        disabled={props.disabled}
        onClick={() => {
          setConfirmingNew(false)
          if (fileInputRef.current) {
            fileInputRef.current.click()
          }
        }}
      >
        Load
      </OutlineButton>
      <OutlineButton className="settings-button" disabled={props.disabled} onClick={handleNewProject}>
        {confirmingNew ? 'Sure? Click again' : 'New project'}
      </OutlineButton>
      {message ? <SettingsNote text={message} /> : null}
    </>
  )
}
