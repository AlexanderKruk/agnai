import { Component, createMemo, createSignal, onCleanup, Show } from 'solid-js'
import { AppSchema } from '../../../../common/types/schema'
import NoCharacterIcon from '../../../icons/NoCharacterIcon'
import WizardIcon from '../../../icons/WizardIcon'
import { AutoCompleteOption } from '../../../shared/AutoComplete'
import { chatStore, msgStore, toastStore, userStore } from '../../../store'
import { useDraft } from '../../../shared/hooks'
import { getFileAsDataURL } from '../../../shared/FileInput'
import { attachmentStore } from '../../../store/attachmentStore'

// Import our extracted components
import MessageInput from './MessageInput'
import VoiceRecorder from './VoiceRecorder'
import FileUploadHandler from './FileUploadHandler'
import ChatActions from './ChatActions'

const InputBar: Component<{
  chat: AppSchema.Chat
  char?: AppSchema.Character
  senderName: string
  chatEditing: boolean
  showOocToggle?: boolean
  ooc?: boolean
  more: (msg: string) => void
  send: (msg: string, ooc: boolean) => void
  botMap: Record<string, AppSchema.Character>
  activeBots?: AppSchema.Character[]
}> = (props) => {
  const state = chatStore((s) => ({
    chatId: s.active?.chat._id,
    memberIds: s.memberIds,
  }))

  const chats = chatStore((s) => ({
    replyAs: s.active?.replyAs,
  }))

  const user = userStore()
  const ctx = msgStore((s) => ({
    waiting: s.waiting,
    canCaption: s.canImageCaption,
    msgs: s.msgs,
  }))

  const [text, setText] = createSignal('')
  const [complete, setComplete] = createSignal(false)
  const [cleared, setCleared] = createSignal(0)
  const [listening, setListening] = createSignal(false)
  const [dragging, setDragging] = createSignal(false)

  let ref: HTMLTextAreaElement | undefined

  const draft = useDraft(props.chat._id)
  const isOwner = createMemo(() => props.chat.userId === user.user?._id)

  const placeholder = createMemo(() => {
    if (props.ooc) return `Message (OOC)`
    return `Message ${props.char?.name || '...'}`
  })

  const completeOpts = createMemo(() => {
    const characters = Object.values(props.botMap)
    const options: AutoCompleteOption[] = []

    for (const char of characters) {
      options.push({ label: char.name, value: `{{char:${char._id}}}` })
    }

    options.push({ label: 'User Handle', value: '{{user}}' })
    return options
  })

  // Initialize text from draft
  const draftText = draft.restore()
  if (draftText && !text()) {
    setText(draftText)
  }

  const updateText = (value: string) => {
    setText(value)
    draft.update(value)
  }

  const send = () => {
    if (!text()) return
    props.send(text(), !!props.ooc)
    clear()
  }

  const clear = debounce(() => {
    if (ref) {
      ref.focus()
      ref.value = ''
      setText('')
      setCleared(cleared() + 1)
      draft.clear()
    }
  }, 100)

  const handleTypingStart = debounce(() => {
    // TODO: Implement typing indicator
    // msgStore.getState().typing(props.chat._id)
  }, 1000)

  const onFile = async (files: any[]) => {
    if (!files.length) return
    const [file] = files
    await attach(file.file)
  }

  const attach = async (file: File) => {
    if (!ctx.canCaption) {
      return toastStore.warn(`Cannot upload files: Image captioning is not available`)
    }

    const result = await getFileAsDataURL(file)
    attachmentStore.setAttachment(state.chatId!, result.content)
  }

  const onCompleteSelect = (option: AutoCompleteOption) => {
    const prev = text()
    const index = prev.lastIndexOf('@')
    if (index === -1) return

    const before = prev.slice(0, index)
    const after = prev.slice(index + 1)
    const newText = before + option.value + ' ' + after.replace(/^\w+\s*/, '')
    updateText(newText)
    setComplete(false)
  }

  const toggleOoc = () => {
    props.send('', !props.ooc)
  }

  const setAutoReplyAs = (charId: string) => {
    chatStore.setAutoReplyAs(charId)
  }

  // Listen for media tag insertion events
  const handleMediaTagInsert = (event: CustomEvent) => {
    const { tag } = event.detail
    updateText(text() + tag)
  }

  document.addEventListener('insertMediaTag', handleMediaTagInsert as EventListener)
  onCleanup(() => {
    document.removeEventListener('insertMediaTag', handleMediaTagInsert as EventListener)
  })

  return (
    <div class="relative flex items-start justify-center rounded-md bg-[var(--bg-800)]">
      <Show when={props.showOocToggle}>
        <div class="flex h-[40px] cursor-pointer items-center p-2" onClick={toggleOoc}>
          <Show when={!props.ooc}>
            <WizardIcon />
          </Show>
          <Show when={props.ooc}>
            <NoCharacterIcon color="var(--bg-500)" />
          </Show>
        </div>
      </Show>

      <ChatActions
        chat={props.chat}
        char={props.char}
        activeBots={props.activeBots || []}
        replyAs={chats.replyAs}
        showOocToggle={props.showOocToggle}
        ooc={props.ooc}
        isOwner={isOwner()}
        canImageCaption={ctx.canCaption}
        onAutoReplyAs={setAutoReplyAs}
        onToggleOoc={toggleOoc}
        onFile={onFile}
      />

      <MessageInput
        text={text()}
        placeholder={placeholder()}
        culture={props.char?.culture}
        canMobileSend={window.innerWidth <= 768 ? user.ui.mobileSendOnEnter : true}
        dragging={dragging()}
        completeOptions={completeOpts()}
        showComplete={complete()}
        onTextChange={updateText}
        onSubmit={send}
        onTypingStart={handleTypingStart}
        onCompleteSelect={onCompleteSelect}
        onCompleteClose={() => setComplete(false)}
        onFileAttach={attach}
        onSetDragging={setDragging}
        ref={ref!}
      />

      <FileUploadHandler
        chatId={state.chatId!}
        canImageCaption={ctx.canCaption}
      />

      <VoiceRecorder
        hasText={!!text()}
        listening={listening()}
        culture={props.char?.culture}
        speechToTextEnabled={!!user.user?.speechtotext}
        onText={updateText}
        onSubmit={send}
        onListeningChange={setListening}
        cleared={cleared}
      />
    </div>
  )
}

function debounce<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(null, args), delay)
  }) as T
}

export default InputBar