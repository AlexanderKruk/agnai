import { Component, createSignal, For, Show } from 'solid-js'
import {
  MoreVertical,
  MessageCircle,
  ImagePlus,
  PlusCircle,
  Megaphone,
  Zap,
  ImageUp,
  Download,
  RotateCcw,
  Trash,
} from 'lucide-solid'
import { AppSchema } from '../../../../common/types/schema'
import Button, { LabelButton } from '../../../shared/Button'
import { DropMenu } from '../../../shared/DropMenu'
import { Toggle } from '../../../shared/Toggle'
import FileInput, { FileInputResult } from '/web/shared/FileInput'
import { msgStore } from '/web/store'
import { chatStore } from '/web/store/chat'

export interface ChatActionsProps {
  chat: AppSchema.Chat
  char?: AppSchema.Character
  lastMsg?: { characterId?: string }
  activeBots: AppSchema.Character[]
  replyAs?: string
  showOocToggle?: boolean
  ooc?: boolean
  isOwner: boolean
  canImageCaption: boolean
  preset?: {
    thirdPartyFormat?: string
  }
  onAutoReplyAs: (charId: string) => void
  onToggleOoc: () => void
  onFile: (files: FileInputResult[]) => void
}

const ChatActions: Component<ChatActionsProps> = (props) => {
  const [menu, setMenu] = createSignal(false)

  const createImage = () => {
    msgStore.createImage()
    setMenu(false)
  }

  const respondAgain = () => {
    msgStore.request(props.chat._id, props.chat.characterId)
    setMenu(false)
  }

  const more = () => {
    // This would need to be passed down from parent
    // props.more(state.lastMsg.msg)
    setMenu(false)
  }

  const playVoice = () => {
    // Voice functionality would need to be passed down or handled differently
    // This is complex logic that might stay in the parent
    setMenu(false)
  }

  const triggerEvent = () => {
    // Event triggering logic would need to be passed down
    setMenu(false)
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
      <Button
        schema="clear"
        onClick={() => setMenu(!menu())}
        class="tour-message-actions h-full bg-[var(--bg-800)] px-2 py-2"
      >
        <MoreVertical class="icon-button" />
      </Button>
      
      <DropMenu show={menu()} close={() => setMenu(false)} vert="up" horz="right">
        <div class="flex w-48 flex-col gap-2 p-2">
          <Show when={false}>
            <Button
              schema="secondary"
              class="w-full"
              onClick={() => {
                setMenu(false)
                msgStore.selfGenerate()
              }}
              alignLeft
              disabled={true} // ctx.impersonate would need to be passed
            >
              <MessageCircle size={18} />
              Respond as Me
            </Button>
          </Show>
          
          <Show when={props.activeBots.length > 1}>
            <div>Auto-reply</div>
            <Button
              schema="secondary"
              size="sm"
              onClick={() => props.onAutoReplyAs('')}
              disabled={!props.replyAs}
            >
              None
            </Button>
            <For each={props.activeBots}>
              {(char) => (
                <Button
                  schema="secondary"
                  size="sm"
                  onClick={() => props.onAutoReplyAs(char._id)}
                  disabled={props.replyAs === char._id}
                >
                  {char.name}
                </Button>
              )}
            </For>
            <hr />
          </Show>
          
          <Show when={props.showOocToggle}>
            <Button
              schema="secondary"
              size="sm"
              class="flex items-center justify-between"
              onClick={props.onToggleOoc}
            >
              <div>Stop Bot Reply</div>
              <Toggle fieldName="ooc" value={props.ooc} onChange={props.onToggleOoc} />
            </Button>
          </Show>
          
          <Show when={false}>
            <Button schema="secondary" class="w-full" onClick={createImage} alignLeft>
              <ImagePlus size={18} /> Generate Image
            </Button>
          </Show>
          
          <Show when={!!props.lastMsg?.characterId && props.isOwner}>
            <Show when={false}>
              <Button schema="secondary" class="w-full" onClick={respondAgain} alignLeft>
                <PlusCircle size={18} /> Respond Again
              </Button>
            </Show>
            <Show when={false}>
              <Button schema="secondary" class="w-full" onClick={more} alignLeft>
                <PlusCircle size={18} /> Generate More
              </Button>
            </Show>
            <Show when={!!props.char?.voice?.service}>
              <Button schema="secondary" class="w-full" onClick={playVoice} alignLeft>
                <Megaphone size={18} /> Play Voice
              </Button>
            </Show>
            <Show when={!!props.chat?.scenarioIds?.length && props.isOwner}>
              <Button schema="secondary" class="w-full" onClick={triggerEvent} alignLeft>
                <Zap /> Trigger Event
              </Button>
            </Show>
          </Show>
          
          <Show when={supportsFileUpload()}>
            <FileInput
              fieldName="imageCaption"
              parentClass="hidden"
              onUpdate={props.onFile}
              accept="image/jpg,image/png,image/jpeg"
            />
            <LabelButton for="imageCaption" schema="secondary" class="w-full" alignLeft>
              <ImageUp size={18} />
              Attach Image
            </LabelButton>
          </Show>
          
          <Show when={false}>
            <hr class="my-1 border-[var(--bg-600)]" />
          </Show>
          
          <Button
            schema="secondary"
            class="w-full"
            onClick={() => {
              setMenu(false)
              chatStore.option({ modal: 'export' })
            }}
            alignLeft
          >
            <Download size={18} /> Download
          </Button>
          
          <Button
            schema="secondary"
            class="w-full"
            onClick={() => {
              setMenu(false)
              chatStore.option({ modal: 'restart' })
            }}
            alignLeft
          >
            <RotateCcw size={18} /> Restart
          </Button>
          
          <Button
            schema="secondary"
            class="w-full"
            onClick={() => {
              setMenu(false)
              chatStore.option({ modal: 'delete' })
            }}
            alignLeft
          >
            <Trash size={18} /> Delete
          </Button>
        </div>
      </DropMenu>
    </>
  )
}

export default ChatActions