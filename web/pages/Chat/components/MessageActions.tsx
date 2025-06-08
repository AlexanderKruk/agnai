import { Component, createMemo, For, Show, JSX, Accessor, Signal } from 'solid-js'
import { Portal } from 'solid-js/web'
import { msgStore } from '/web/store/message'
import { chatStore } from '/web/store/chat'
import { AppSchema } from '/common/types/schema'
import { ButtonSchema } from '/web/shared/Button'

// Define LucideProps locally since it's not exported
interface LucideProps {
  size?: number
  color?: string
  strokeWidth?: number
}
import { UI } from '/common/types'
import {
  Terminal,
  ImagePlus,
  Pencil,
  Split,
  RefreshCw,
  Braces,
  Trash,
  Repeat1
} from 'lucide-solid'

// Helper type for split messages
export interface SplitMessage extends AppSchema.ChatMessage {
  characterId?: string
}

export interface MessageActionsProps {
  index: number
  msg: SplitMessage
  ui: UI.UISettings
  tts: boolean
  edit: Accessor<boolean>
  startEdit: () => void
  last?: boolean
  partial?: string
  show: Signal<boolean>
  textBeforeGenMore?: string
  onRemove: () => void
  showMore: Signal<boolean>
}

export const MessageActions: Component<MessageActionsProps> = (props) => {
  const closer = (action: () => void) => {
    return () => {
      action()
      props.showMore[1](false)
    }
  }

  const logic = createMemo(() => {
    const items: Record<
      UI.MessageOption,
      {
        key: UI.MessageOption
        outer: { outer: boolean; pos: number }
        label: string
        class: string
        onClick: () => void
        show: boolean
        schema?: ButtonSchema
        icon: (props: LucideProps) => JSX.Element
      }
    > = {
      prompt: {
        key: 'prompt',
        label: 'Prompt',
        class: 'prompt-btn',
        outer: props.ui.msgOptsInline.prompt,
        show: !!props.msg.characterId && props.msg.adapter !== 'image',
        onClick: () => !props.partial && chatStore.computePrompt(props.msg, true),
        icon: Terminal,
      },

      image: {
        key: 'image',
        label: 'Generate Image',
        class: 'image-btn',
        outer: props.ui.msgOptsInline.image,
        show: !!props.msg.characterId && !props.msg.system && !props.msg.event && props.msg.adapter !== 'image' && !props.partial && !props.msg.json,
        onClick: () => {
          msgStore.createImage(props.msg._id, false, props.msg.msg)
        },
        icon: ImagePlus,
      },

      edit: {
        key: 'edit',
        label: 'Edit',
        class: 'edit-btn',
        outer: props.ui.msgOptsInline.edit,
        show: !props.msg.characterId && props.msg.adapter !== 'image' && !props.partial,
        onClick: props.startEdit,
        icon: Pencil,
      },

      fork: {
        key: 'fork',
        label: 'Fork',
        class: 'fork-btn',
        show: !props.last,
        outer: props.ui.msgOptsInline.fork,
        onClick: () => !props.partial && msgStore.fork(props.msg._id),
        icon: Split,
      },

      regen: {
        key: 'regen',
        class: 'refresh-btn',
        label: 'Regenerate',
        outer: props.ui.msgOptsInline.regen,
        show:
          (props.last || (props.msg.adapter === 'image' && !!props.msg.imagePrompt)) &&
          !!props.msg.characterId,
        onClick: () => !props.partial && retryMessage(props.msg, props.msg),
        icon: RefreshCw,
      },

      'schema-regen': {
        key: 'schema-regen',
        class: 'refresh-btn',
        label: 'Schema Regen',
        outer: props.ui.msgOptsInline['schema-regen'],
        show:
          window.flags.reschema &&
          ((props.msg.json && props.last) ||
            (props.msg.adapter === 'image' && !!props.msg.imagePrompt)) &&
          !!props.msg.characterId,
        onClick: () => !props.partial && retryJsonSchema(props.msg, props.msg),
        icon: Braces,
      },

      trash: {
        key: 'trash',
        label: 'Delete',
        show: true,
        outer: props.ui.msgOptsInline.trash,
        onClick: props.onRemove,
        class: 'delete-btn',
        schema: 'red',
        icon: Trash,
      },
    }

    return items
  })

  const order = createMemo(() => {
    logic()

    return Object.entries(props.ui.msgOptsInline)
      .sort((l, r) => l[1].pos - r[1].pos)
      .map(([key, item]) => ({ key: key as UI.MessageOption, ...item }))
  })

  return (
    <div class="mr-3 flex items-center gap-4 text-sm">
      <div class="contents" id={`outer-${props.msg._id}`}></div>

      <For each={order()}>
        {(item) => {
          const def = logic()[item.key]

          return (
            <Show when={def.outer.outer && def.show}>
              <MessageOption
                id={props.msg._id}
                onClick={closer(def.onClick)}
                class={def.class}
                label={def.label}
              >
                {def.icon({ size: 18 })}
              </MessageOption>
            </Show>
          )
        }}
      </For>

      <Show
        when={
          (props.last || (props.msg.adapter === 'image' && props.msg.imagePrompt)) &&
          props.msg.characterId &&
          !!props.textBeforeGenMore
        }
      >
        <div
          class="icon-button"
          onClick={() => !props.partial && msgStore.continuation(props.msg.chatId, undefined, true)}
        >
          <Repeat1 size={18} />
        </div>
      </Show>

      <Show when={props.last && !props.msg.characterId}>
        <div
          class="icon-button"
          onClick={() => !props.partial && msgStore.resend(props.msg.chatId, props.msg._id)}
        >
          <RefreshCw size={18} />
        </div>
      </Show>

      <div
        class="icon-button"
        onClick={props.onRemove}
        title="Delete"
      >
        <Trash size={18} />
      </div>
    </div>
  )
}

const MessageOption: Component<{
  class?: string;
  id: string;
  onClick: () => void;
  label: string;
  children: JSX.Element;
}> = (props) => {
  return (
    <Portal mount={document.querySelector(`#outer-${props.id}`)!}>
      <div
        class={`icon-button ${props.class || ''}`}
        onClick={props.onClick}
        title={props.label}
      >
        {props.children}
      </div>
    </Portal>
  );
};

function retryMessage(original: AppSchema.ChatMessage, split: SplitMessage) {
  if (original.adapter !== 'image') {
    msgStore.retry(split.chatId, original._id)
  } else {
    msgStore.createImage(split._id)
  }
}

function retryJsonSchema(original: AppSchema.ChatMessage, split: SplitMessage) {
  msgStore.retrySchema(split.chatId, original._id)
}