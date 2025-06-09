import { Component, createSignal, Show } from 'solid-js'
import { ImageUp, Image } from 'lucide-solid'
import Button, { LabelButton } from '../../../shared/Button'
import TextInput from '../../../shared/TextInput'
import FileInput, { FileInputResult, getFileAsDataURL } from '/web/shared/FileInput'
import { attachmentStore } from '/web/store/attachmentStore'
import { toastStore } from '/web/store/toasts'

export interface FileUploadHandlerProps {
  chatId: string
  canImageCaption: boolean
  preset?: {
    thirdPartyFormat?: string
  }
}

const FileUploadHandler: Component<FileUploadHandlerProps> = (props) => {
  const [showMediaModal, setShowMediaModal] = createSignal(false)
  const [mediaType, setMediaType] = createSignal<'photo' | 'video'>('photo')
  const [mediaDescription, setMediaDescription] = createSignal('')
  const [dragging, setDragging] = createSignal(false)

  const onFile = async (files: FileInputResult[]) => {
    if (!files.length) return

    const [file] = files
    await attach(file.file)
  }

  const attach = async (file: File) => {
    if (!props.canImageCaption) {
      return toastStore.warn(`Cannot upload files: Image captioning is not available`)
    }

    const buffer = await getFileAsDataURL(file)
    attachmentStore.setAttachment(props.chatId, buffer)
  }

  const openMediaModal = () => {
    setMediaDescription('')
    setShowMediaModal(true)
  }

  const insertMediaTag = () => {
    const tag = `[${mediaType()}: ${mediaDescription()}]`
    setShowMediaModal(false)
    setMediaDescription('')
    // Return the tag to be inserted into the text input
    return tag
  }


  const supportsFileUpload = () => {
    return (
      props.preset?.thirdPartyFormat === 'ollama' ||
      props.preset?.thirdPartyFormat === 'vllm' ||
      props.preset?.thirdPartyFormat === 'openai-chat' ||
      props.preset?.thirdPartyFormat === 'openai-chatv2'
    )
  }

  return (
    <>
      {/* File Upload Button */}
      <Show when={supportsFileUpload()}>
        <FileInput
          fieldName="imageCaption"
          parentClass="hidden"
          onUpdate={onFile}
          accept="image/jpg,image/png,image/jpeg"
        />
        <LabelButton for="imageCaption" schema="secondary" class="w-full" alignLeft>
          <ImageUp size={18} />
          Attach Image
        </LabelButton>
      </Show>

      {/* Media Insert Button */}
      <Button schema="clear" onClick={openMediaModal} class="mt-1">
        <Image class="icon-button" size={18} />
      </Button>

      {/* Media Modal */}
      <Show when={showMediaModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div class="w-96 rounded-md bg-[var(--bg-800)] p-4 shadow-lg">
            <h3 class="mb-3 text-lg font-semibold">Insert Media</h3>
            
            <div class="mb-4 flex justify-center">
              <div class="flex rounded bg-[var(--bg-700)] p-1">
                <button
                  class={`px-4 py-1 rounded ${mediaType() === 'photo' ? 'bg-[var(--bg-500)]' : ''}`}
                  onClick={() => setMediaType('photo')}
                >
                  Photo
                </button>
                <button
                  class={`px-4 py-1 rounded ${mediaType() === 'video' ? 'bg-[var(--bg-500)]' : ''}`}
                  onClick={() => setMediaType('video')}
                >
                  Video
                </button>
              </div>
            </div>
            
            <div class="mb-4">
              <TextInput
                fieldName="mediaDescription"
                placeholder="Enter description..."
                value={mediaDescription()}
                onChange={(ev) => setMediaDescription((ev.target as HTMLInputElement).value)}
                input={{
                  autofocus: true
                }}
                isMultiline
                class="bg-[var(--bg-700)] focus:bg-[var(--bg-600)] hover:bg-[var(--bg-600)] max-h-[120px] min-h-[40px]"
              />
            </div>
            
            <div class="flex justify-end space-x-2">
              <Button schema="secondary" onClick={() => setShowMediaModal(false)}>
                Cancel
              </Button>
              <Button 
                schema="primary" 
                onClick={() => {
                  const tag = insertMediaTag()
                  // Emit event with the tag to be inserted
                  const event = new CustomEvent('insertMediaTag', { detail: { tag } })
                  document.dispatchEvent(event)
                }} 
                disabled={!mediaDescription()}
              >
                Insert
              </Button>
            </div>
          </div>
        </div>
      </Show>

      {/* Drag overlay indicator */}
      <Show when={dragging()}>
        <div class="absolute inset-0 flex items-center justify-center bg-blue-500 bg-opacity-20 border-2 border-dashed border-blue-400 rounded-md">
          <div class="text-blue-600 font-semibold">Drop file to attach</div>
        </div>
      </Show>
    </>
  )
}

export default FileUploadHandler

// Export drag handlers for use in parent components
export const createDragHandlers = (onDrop: (file: File) => void, setDragging: (dragging: boolean) => void) => ({
  onDragOver: (ev: DragEvent) => {
    ev.preventDefault()
    setDragging(true)
  },
  onDragExit: () => {
    setDragging(false)
  },
  onDragEnd: (ev: DragEvent) => {
    setDragging(false)
  },
  onDrop: (ev: DragEvent) => {
    ev.preventDefault()
    setDragging(false)
    const file = ev.dataTransfer?.files[0]
    if (!file) return
    onDrop(file)
  },
})