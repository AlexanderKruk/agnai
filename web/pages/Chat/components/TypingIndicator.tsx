import { Component, createMemo, Show } from 'solid-js'
import { msgStore } from '../../../store'
import { useAppContext } from '../../../store/context'

export const TypingIndicator: Component = () => {
  const [ctx] = useAppContext()
  const msgs = msgStore((s) => ({ typing: s.typing }))

  const typingCharacter = createMemo(() => {
    if (!msgs.typing) return undefined
    return ctx.allBots[msgs.typing.characterId]
  })

  return (
    <div class="w-full flex justify-left ml-[32px] h-[12px] mb-2">
      <Show when={msgs.typing && typingCharacter()}>
        <span class="dot-flashing bg-blue-500"></span>
      </Show>
    </div>
  )
} 