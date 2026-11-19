<script setup lang="ts">
// Every dialog the contacts screens open, mounted once by each contacts
// page so the sidebar and the palette can open them from either
const { editorOpen, editing, submit, books, duplicatesOpen, importOpen, exportOpen } = useContactsPage()
</script>

<template>
  <ContactsEditor
    v-model:open="editorOpen"
    :contact="editing"
    :books="books"
    @save="submit"
  />
  <ContactsDuplicates v-model:open="duplicatesOpen" />
  <ContactsGroupDialog />
  <ContactsImport v-model:open="importOpen" />
  <ContactsExport v-model:open="exportOpen" />
</template>
