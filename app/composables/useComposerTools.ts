// The composer's pop-ups, opened from their own buttons and from the slash
// commands in the editor (/template, /tone, /later, /attach, /emoji, /sign…)
// and the palette
const _useComposerTools = () => {
  const templates = ref(false)
  const tone = ref(false)
  const later = ref(false)
  /** Bumped to open the file picker, which lives in the composer's footer */
  const pickFiles = ref(0)
  /** Bumped to open the picture picker in the toolbar */
  const pickImage = ref(0)
  const emoji = ref(false)
  const table = ref(false)
  /** The signature menu in the footer */
  const signature = ref(false)
  /** The dialog to add, rename and edit signatures */
  const manageSignatures = ref(false)
  /** Distraction-free writing: the draft on screen fills the window */
  const zen = ref(false)
  /** Where the cursor last was in the composer, so an emoji goes back there */
  const lastField = ref<'body' | 'subject'>('body')
  const subjectInput = shallowRef<HTMLInputElement>()

  return { templates, tone, later, pickFiles, pickImage, emoji, table, signature, manageSignatures, zen, lastField, subjectInput }
}

export const useComposerTools = createAppComposable(_useComposerTools)
