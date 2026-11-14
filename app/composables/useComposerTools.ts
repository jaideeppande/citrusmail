// The composer's pop-ups, opened from their own buttons and from the slash
// commands in the editor (/template, /tone, /later, /attach)
const _useComposerTools = () => {
  const templates = ref(false)
  const tone = ref(false)
  const later = ref(false)
  /** Bumped to open the file picker, which lives in the composer's footer */
  const pickFiles = ref(0)

  return { templates, tone, later, pickFiles }
}

export const useComposerTools = createAppComposable(_useComposerTools)
