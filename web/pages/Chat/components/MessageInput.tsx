import { Component, createSignal, Show, createEffect, on } from 'solid-js'
import TextInput from '../../../shared/TextInput'
import { AutoComplete, AutoCompleteOption } from '../../../shared/AutoComplete'
import { createDragHandlers } from './FileUploadHandler'

export interface MessageInputProps {
  text: string
  placeholder: string
  culture?: string
  canMobileSend?: boolean
  dragging?: boolean
  completeOptions?: AutoCompleteOption[]
  showComplete?: boolean
  
  onTextChange: (text: string) => void
  onSubmit: () => void
  onTypingStart: () => void
  onCompleteSelect: (option: AutoCompleteOption) => void
  onCompleteClose: () => void
  onFileAttach?: (file: File) => void
  onSetDragging?: (dragging: boolean) => void
  
  ref?: HTMLTextAreaElement
}

const MessageInput: Component<MessageInputProps> = (props) => {
  const [complete, setComplete] = createSignal(false)
  const [dragging, setDragging] = createSignal(false)

  // Sync internal dragging state with parent if provided
  createEffect(on(() => props.dragging, (parentDragging) => {
    if (parentDragging !== undefined) {
      setDragging(parentDragging)
    }
  }))

  // Notify parent of dragging state changes
  createEffect(on(dragging, (isDragging) => {
    props.onSetDragging?.(isDragging)
  }))

  const dragHandlers = props.onFileAttach ? createDragHandlers(props.onFileAttach, setDragging) : {}

  const handleKeyDown = (ev: KeyboardEvent) => {
    props.onTypingStart()

    if (ev.key === '@') {
      setComplete(true)
    }

    const canSend = props.canMobileSend ?? true
    const isCompleteShowing = complete() || props.showComplete
    if (ev.key === 'Enter' && !ev.shiftKey && canSend) {
      if (isCompleteShowing) return
      props.onSubmit()
      ev.preventDefault()
    }
  }

  const handleCompleteSelect = (option: AutoCompleteOption) => {
    props.onCompleteSelect(option)
    setComplete(false)
  }

  const handleCompleteClose = () => {
    setComplete(false)
    props.onCompleteClose?.()
  }

  return (
    <div class="relative flex w-full">
      <Show when={complete() || props.showComplete}>
        <AutoComplete
          options={props.completeOptions || []}
          close={handleCompleteClose}
          onSelect={handleCompleteSelect}
          dir="up"
          offset={44}
        />
      </Show>
      
      <TextInput
        fieldName="chatInput"
        isMultiline
        spellcheck
        lang={props.culture}
        ref={props.ref! as any}
        value={props.text}
        placeholder={props.placeholder}
        parentClass="flex w-full"
        classList={{ 'blur-md': dragging() }}
        class="input-bar max-h-[120px] min-h-[40px] rounded-r-none hover:bg-[var(--bg-800)] active:bg-[var(--bg-800)] text-lg sm:text-base"
        onFocus={props.onTypingStart}
        onKeyDown={handleKeyDown}
        onChange={(ev) => props.onTextChange((ev.target as HTMLTextAreaElement).value)}
        textarea={dragHandlers}
      />
      
      <Show when={dragging()}>
        <div class="absolute inset-0 flex items-center justify-center bg-blue-500 bg-opacity-20 border-2 border-dashed border-blue-400 rounded-md">
          <div class="text-blue-600 font-semibold">Drop file to attach</div>
        </div>
      </Show>
    </div>
  )
}

export default MessageInput