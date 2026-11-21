// Save and load (SPEC step 18). Auto-save happens on its own; this panel
// handles the downloadable file and starting a new project.
import { useState } from 'react'
import { downloadProjectFile, loadProjectFile, startNewProject } from '../project/saveLoad.ts'

export function ProjectFilePanel() {
  const [message, setMessage] = useState('')

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
    if (window.confirm('Start a new project? The current one will be replaced.')) {
      startNewProject()
      setMessage('New project started.')
    }
  }

  return (
    <fieldset>
      <legend>Project file</legend>
      <p>Changes are saved in this browser automatically.</p>
      <button onClick={downloadProjectFile}>Download project file</button>{' '}
      <label>
        Load project file:{' '}
        <input
          type="file"
          accept=".json,application/json"
          onChange={(event) => {
            handleFileChosen(event.target.files?.[0])
            event.target.value = '' // so the same file can be loaded again
          }}
        />
      </label>{' '}
      <button onClick={handleNewProject}>New project</button>
      {message ? <p>{message}</p> : null}
    </fieldset>
  )
}
