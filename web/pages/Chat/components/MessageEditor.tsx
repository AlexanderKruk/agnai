import { Component, createMemo, For, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import { AppSchema } from '/common/types/schema'
import { Pill } from '/web/shared/Card'

export type SplitMessage = AppSchema.ChatMessage & { split?: boolean; handle?: string }

export interface MessageEditorProps {
  msg: SplitMessage
  update: (next: any) => void
}

export const MessageEditor: Component<MessageEditorProps> = (props) => {
  const entries = createMemo(() => Object.keys(props.msg.json?.values || {}))
  const [editing, setEditing] = createStore<Record<string, string>>(props.msg.json?.values || {})

  onMount(() => {
    props.update(props.msg.json?.values || {})
  })

  return (
    <div class="flex flex-col gap-2">
      <For each={entries()}>
        {(key) => (
          <div class="flex flex-col">
            <Pill type="bg" small opacity={0.5} class="rounded-b-none rounded-t-md">
              {key}
            </Pill>
            <div
              ref={(r) => (r.innerText = editing[key])}
              class="msg-edit-text-box rounded-md rounded-tl-none border border-[var(--bg-500)] p-1"
              contentEditable={true}
              onKeyUp={(ev: any) => {
                setEditing(key, ev.target.innerText)
                props.update(editing)
              }}
            ></div>
          </div>
        )}
      </For>
    </div>
  )
}