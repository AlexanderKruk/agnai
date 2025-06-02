import './Message.css'
import Purify from 'dompurify'
import {
  Check,
  CheckCheck,
  DownloadCloud,
  Info,
  PauseCircle,
  Pencil,
  RefreshCw,
  Repeat1,
  Terminal,
  Trash,
  Delete,
  X,
  Zap,
  Split,
  Braces,
  ImagePlus,
} from 'lucide-solid'
import {
  Accessor,
  Component,
  createMemo,
  createSignal,
  For,
  JSX,
  Match,
  onCleanup,
  onMount,
  Show,
  Signal,
  Switch,
  createEffect,
} from 'solid-js'
import { BOT_REPLACE, SELF_REPLACE } from '../../../../common/prompt'
import { AppSchema } from '../../../../common/types/schema'
import AvatarIcon, { CharacterAvatar } from '../../../shared/AvatarIcon'
import { chatStore, userStore, msgStore, toastStore, ChatState, VoiceState } from '../../../store'
import { markdown } from '../../../shared/markdown'
import Button, { ButtonSchema } from '/web/shared/Button'
import { rootModalStore } from '/web/store/root-modal'
import { ContextState, useAppContext } from '/web/store/context'
import { hydrateTemplate, trimSentence } from '/common/util'
import { EVENTS, events } from '/web/emitter'
import TextInput from '/web/shared/TextInput'
import { Card, Pill } from '/web/shared/Card'
import { FeatureFlags } from '/web/store/flags'
import { DropMenu } from '/web/shared/DropMenu'
import { ChatTree } from '/common/chat'
import { Portal } from 'solid-js/web'
import { UI } from '/common/types'
import { LucideProps } from 'lucide-solid/dist/types/types'
import { createStore } from 'solid-js/store'
import { RelativeSpinner } from '/web/shared/Loading'
import { LogProbs } from './LogProbs'
import { MessageImages } from './MessageImages'

/**
 * Advanced Universal Emoji Text Splitter
 * Splits after each emoji, ellipsis, and punctuation while keeping consecutive emojis together
 * Keeps punctuation + emoji combinations on the same line
 * Also splits when encountering '[' for roleplay actions
 */
function splitTextOnEmojisAndEllipsis(text: string): string[] {
  if (!text || !text.trim()) return []
  
  // More comprehensive emoji pattern that handles complex sequences
  const emojiPattern = '(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}][\uFE0E\uFE0F]?(?:\u{200D}[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}][\uFE0E\uFE0F]?)*)'
  
  // Replace various patterns with special markers, keeping related elements together
  let marked = text
  
  // Handle complex combinations first (punctuation + emoji, ellipsis + emoji, etc.)
  // Pattern: ellipsis + space(s) + consecutive emojis + space
  marked = marked.replace(new RegExp(`\\.\\.\\. *(?:${emojiPattern})+\\s+`, 'gu'), (match) => {
    const trimmed = match.trim()
    return trimmed + '|||SPLIT|||'
  })
  
  // Pattern: punctuation + space(s) + consecutive emojis + space  
  marked = marked.replace(new RegExp(`([!?.]) *(?:${emojiPattern})+\\s+`, 'gu'), (match) => {
    const trimmed = match.trim()
    return trimmed + '|||SPLIT|||'
  })
  
  // Pattern: emoji + space(s) + punctuation + space
  marked = marked.replace(new RegExp(`(${emojiPattern}) *([!?.])\\s+`, 'gu'), '$1$2|||SPLIT|||')
  
  // Handle standalone ellipsis + space (not followed by emoji)
  marked = marked.replace(new RegExp(`\\.\\.\\. +(?!${emojiPattern})`, 'gu'), '...|||SPLIT|||')
  
  // Handle standalone punctuation + space (not followed by emoji)
  marked = marked.replace(new RegExp(`([!?.]) +(?!${emojiPattern})`, 'gu'), '$1|||SPLIT|||')
  
  // Handle standalone emojis + space (most important - this should catch 💁‍♀️)
  marked = marked.replace(new RegExp(`(${emojiPattern})\\s+`, 'gu'), '$1|||SPLIT|||')
  
  // Handle opening brackets [ for roleplay actions/OOC text - split before the bracket
  marked = marked.replace(/\s+(\[)/g, '|||SPLIT|||$1')
  
  // Split and clean up
  const lines = marked.split('|||SPLIT|||')
    .filter(line => line.trim().length > 0)
    .map(line => line.trim())
  
  return lines
}

type MessageProps = {
  msg: SplitMessage
  last?: boolean
  swipe?: string | false
  confirmSwipe?: () => void
  cancelSwipe?: () => void
  discardSwipe?: () => void
  onRemove: () => void
  editing: boolean
  tts?: boolean
  children?: any
  retrying?: AppSchema.ChatMessage
  partial?: string
  sendMessage: (msg: string, ooc: boolean) => void
  isPaneOpen: boolean
  showHiddenEvents?: boolean
  textBeforeGenMore?: string
  voice?: VoiceState
  firstInserted?: boolean
  index: number
  onTypingStart?: () => void
  onFirstLine?: () => void
  onReadingStarted?: () => void
}

const anonNames = new Map<string, number>()

let anonId = 0

function getAnonName(entityId: string) {
  if (!anonNames.has(entityId)) {
    anonNames.set(entityId, ++anonId)
  }

  const id = anonNames.get(entityId)
  return `User ${id}`
}

// Line-by-line renderer component for non-stream mode
const LineByLineRenderer: Component<{
  content: string
  isBot: boolean
  isUser: boolean
  delay: number
  onComplete?: () => void
  onFirstLine?: () => void
  userMessage?: string
  messageId: string
  existingSplitLines?: string[]
}> = (props) => {
  const [visibleLines, setVisibleLines] = createSignal(0)
  const [isComplete, setIsComplete] = createSignal(false)
  const [showLoading, setShowLoading] = createSignal(true) // Always start with loading
  const [hasStarted, setHasStarted] = createSignal(false)
  
  // Timer tracking signals
  const [activeTimers, setActiveTimers] = createSignal<NodeJS.Timeout[]>([])

  // Use existing split lines if available, otherwise split the content
  const lines = createMemo(() => {
    if (props.existingSplitLines && props.existingSplitLines.length > 0) {
      return props.existingSplitLines
    }
    
    const text = props.content.trim()
    if (!text) return []
    
    // Use our advanced emoji splitter function
    const processedLines = splitTextOnEmojisAndEllipsis(text)
    
    // Ensure we have at least something to display
    return processedLines.length > 0 ? processedLines : [text]
  })

  // Save split lines to message meta when rendering is complete
  const saveSplitLines = () => {
    if (!props.existingSplitLines || props.existingSplitLines.length === 0) {
      const splitLines = lines()
      if (splitLines.length > 1) {
        // Only save if we actually have multiple lines
        msgStore.editMessageProp(props.messageId, {
          meta: {
            ...msgStore.getState().msgs.find(m => m._id === props.messageId)?.meta,
            splitLines: splitLines
          }
        })
      }
    }
  }

  // Helper function to clear all active timers
  const clearAllTimers = () => {
    activeTimers().forEach(timer => clearTimeout(timer))
    setActiveTimers([])
  }

  // Helper function to add a timer to tracking
  const addTimer = (timer: NodeJS.Timeout) => {
    setActiveTimers(prev => [...prev, timer])
    return timer
  }

  // Calculate reading delay based on user's message length
  const calculateReadingDelay = (userMsg: string) => {
    if (!userMsg) return 1000 // Default 1 second if no user message
    
    const words = userMsg.split(/\s+/).length
    // Assume reading speed of ~4 words per second
    const readingTime = (words / 4) * 1000
    
    // Add some randomness and minimum time
    const minReadingTime = 800
    const maxReadingTime = 3000
    const randomizedTime = readingTime * (0.8 + Math.random() * 0.6) // 0.8x to 1.4x
    
    return Math.max(minReadingTime, Math.min(maxReadingTime, randomizedTime))
  }

  // Calculate thinking delay - time to process and formulate response
  const calculateThinkingDelay = () => {
    // Thinking time varies based on response complexity
    const baseThinking = 1200 // Base thinking time
    const complexityFactor = Math.min(lines().length * 0.3, 1.5) // More lines = more thinking
    const randomFactor = 0.7 + Math.random() * 0.8 // 0.7x to 1.5x variation
    
    return (baseThinking * complexityFactor * randomFactor)
  }

  // Calculate dynamic delay based on line length with randomness
  const calculateLineDelay = (lineText: string, baseDelay: number) => {
    // Base calculation: longer lines get longer delays
    const textLength = lineText.length
    const wordsCount = lineText.split(/\s+/).length
    
    // Base delay calculation based on reading speed
    // Assume ~3-4 words per second reading speed, plus time for "typing"
    const readingTime = (wordsCount / 3.5) * 1000 // milliseconds
    const typingTime = textLength * 30 // ~30ms per character typing simulation
    
    // Combine reading and typing time, but use baseDelay as minimum
    const calculatedDelay = Math.max(baseDelay * 0.5, readingTime + typingTime)
    
    // Add randomness on the bigger side (20% to 60% additional time)
    const randomMultiplier = 1 + (Math.random() * 0.4 + 0.2) // 1.2x to 1.6x
    const finalDelay = calculatedDelay * randomMultiplier
    
    // Cap the maximum delay to prevent extremely long waits
    const maxDelay = baseDelay * 4
    return Math.min(finalDelay, maxDelay)
  }

  const displayContent = createMemo(() => {
    const linesToShow = lines().slice(0, visibleLines())
    return linesToShow.join('\n\n')
  })

  const renderedContent = createMemo(() => {
    const content = displayContent()
    return Purify.sanitize(
      wrapWithQuoteElement(
        markdown.makeHtml(content).replace(/&amp;nbsp;/g, '&nbsp;')
      )
    )
  })

  // Auto-advance lines with dynamic delays (only after loading has started)
  createEffect(() => {
    if (hasStarted() && visibleLines() < lines().length && !isComplete()) {
      const currentLineIndex = visibleLines()
      const currentLine = lines()[currentLineIndex] || ''
      const dynamicDelay = calculateLineDelay(currentLine, props.delay)
      
      // Split delay evenly between thinking and typing phases
      const baseThinkingDelay = dynamicDelay * 0.5 // 50% for thinking
      const baseTypingDelay = dynamicDelay * 0.5 // 50% for typing
      
      // Add randomness to thinking phase (±40% variation)
      const thinkingRandomness = 0.6 + (Math.random() * 0.8) // 0.6x to 1.4x multiplier
      const thinkingDelay = baseThinkingDelay * thinkingRandomness
      
      // Keep typing delay enhanced for realism
      const typingDelay = baseTypingDelay * 2.5 // Increase typing delay by 2.5x to make it more realistic
      
      // Phase 1: Thinking delay (no indicator) - now with more randomness
      const thinkingTimer = addTimer(setTimeout(() => {
        // Phase 2: Show loading indicator and "type"
        setShowLoading(true)
        
        const typingTimer = addTimer(setTimeout(() => {
          setVisibleLines(prev => prev + 1)
          setShowLoading(false)
        }, typingDelay))
      }, thinkingDelay))

      // Cleanup function for this effect run
      onCleanup(clearAllTimers)
    } else if (hasStarted() && visibleLines() >= lines().length && !isComplete()) {
      setIsComplete(true)
      setShowLoading(false)
      saveSplitLines() // Save the split lines when complete
      props.onComplete?.()
    }
  })

  // Start the response sequence on mount
  onMount(() => {
    if (lines().length > 0) {
      // If we have existing split lines, show immediately without delays
      if (props.existingSplitLines && props.existingSplitLines.length > 0) {
        setHasStarted(true)
        setVisibleLines(props.existingSplitLines.length)
        setIsComplete(true)
        setShowLoading(false)
        props.onComplete?.()
        return
      }

      const readingDelay = calculateReadingDelay(props.userMessage || '')
      const thinkingDelay = calculateThinkingDelay()
      
      // Show initial loading
      setShowLoading(true)
      props.onFirstLine?.() // Notify parent that processing started
      
      // Phase 1: Reading + thinking delay, then start displaying
      const startTimer = addTimer(setTimeout(() => {
        setHasStarted(true)
        setVisibleLines(1)
        setShowLoading(false)
      }, readingDelay + thinkingDelay))
    }
  })

  // Cleanup all timers when component unmounts
  onCleanup(clearAllTimers)

  return (
    <>
      <Show when={hasStarted()}>
        <p
          class="rendered-markdown pr-1 streaming-markdown"
          data-bot-message={props.isBot}
          data-user-message={props.isUser}
          innerHTML={renderedContent()}
        />
      </Show>
      <Show when={showLoading()}>
        <span class="flex h-8 w-12 items-center justify-start pl-4">
          <span class="dot-flashing bg-[var(--hl-700)]"></span>
        </span>
      </Show>
    </>
  )
}

const Message: Component<MessageProps> = (props) => {
  let editRef: HTMLDivElement | undefined
  let avatarRef: any

  const [ctx] = useAppContext()
  const user = userStore()
  const state = chatStore()
  const [edit, setEdit] = createSignal(false)
  const isBot = !!props.msg.characterId
  const isUser = !!props.msg.userId
  const [img, setImg] = createSignal('h-full')
  const opts = createSignal(false)
  const [jsonValues, setJsonValues] = createSignal(props.msg.json?.values || {})

  const showOpt = createSignal(false)

  // State for line-by-line rendering
  const [shouldUseLineByLine, setShouldUseLineByLine] = createSignal(false)
  const [showCharacterInfo, setShowCharacterInfo] = createSignal(true) // Controls when to show char name/avatar

  // State for message read/sent indicators (only for user messages)
  const [messageSent, setMessageSent] = createSignal(false)
  const [messageRead, setMessageRead] = createSignal(false)

  const [obs] = createSignal(
    new ResizeObserver(() => {
      setImg(`calc(${Math.min(avatarRef?.clientHeight, 10000)}px + 1em)`)
    })
  )

  onMount(() => {
    obs().observe(avatarRef)
    
    // Initialize read/sent status for user messages
    if (isUser && !props.msg.ooc) {
      const messageAge = Date.now() - new Date(props.msg.createdAt).getTime()
      const isNewMessage = messageAge < 5000 || props.last // Less than 5 seconds old or is the last message
      
      if (isNewMessage) {
        // For new messages, show the progression: none → check → checkcheck
        // Simulate server request verification with a small delay
        setTimeout(() => {
          setMessageSent(true)
        }, 100 + Math.random() * 200) // 100-300ms delay to simulate server response
        
        // Calculate when message should be marked as "read" using existing delay logic
        const calculateReadingDelay = (userMsg: string) => {
          if (!userMsg) return 1000
          const words = userMsg.split(/\s+/).length
          const readingTime = (words / 4) * 1000
          const minReadingTime = 800
          const maxReadingTime = 3000
          const randomizedTime = readingTime * (0.8 + Math.random() * 0.6)
          return Math.max(minReadingTime, Math.min(maxReadingTime, randomizedTime))
        }
        
        const calculateThinkingDelay = () => {
          const baseThinking = 1200
          const complexityFactor = Math.min((props.msg.msg?.split('\n').length || 1) * 0.3, 1.5)
          const randomFactor = 0.7 + Math.random() * 0.8
          return (baseThinking * complexityFactor * randomFactor)
        }
        
        // Simulate read status after a delay (only after message is sent)
        const readDelay = calculateReadingDelay(props.msg.msg || '') + calculateThinkingDelay()
        setTimeout(() => {
          if (messageSent()) {
            setMessageRead(true)
          }
        }, readDelay + 300) // Add small buffer to ensure sent status is shown first
      } else {
        // For old messages, immediately show as read
        setMessageSent(true)
        setMessageRead(true)
      }
    }
  })
  
  onCleanup(() => obs().disconnect())

  const format = createMemo(() => ({ size: user.ui.avatarSize, corners: user.ui.avatarCorners }))
  const content = createMemo(() => {
    const msgV2 = getMessageContent(ctx, props, state)
    return msgV2
  })

  // Check if we should use line-by-line for new bot messages
  createEffect(() => {
    const isNewBotMessage = props.msg.characterId && props.last && !props.partial && !props.retrying
    const isNonStreamMode = !props.partial // Not currently streaming
    const hasContent = props.msg.msg && props.msg.msg.trim()
    const lineByLineEnabled = user.ui.lineByLineDisplay ?? true
    const existingSplitLines = props.msg.meta?.splitLines as string[] | undefined
    
    // Alternative detection: any bot message without existing split lines that isn't currently streaming
    const isBotMessageWithoutSplits = props.msg.characterId && !props.partial && !props.retrying && 
                                      (!existingSplitLines || existingSplitLines.length === 0)
    
    // More relaxed conditions - trigger for any bot message that has content and no existing splits, OR new bot messages
    if ((isNewBotMessage || isBotMessageWithoutSplits) && isNonStreamMode && hasContent && lineByLineEnabled) {
      // If we have existing split lines, show character info immediately
      if (existingSplitLines && existingSplitLines.length > 0) {
        setShowCharacterInfo(true)
        setShouldUseLineByLine(true)
      } else {
        // Hide character info initially for new line-by-line mode
        setShowCharacterInfo(false)
        setShouldUseLineByLine(true)
      }
    } else {
      // Show character info immediately for normal messages
      setShowCharacterInfo(true)
    }
  })

  // Get existing split lines from message meta
  const getExistingSplitLines = createMemo(() => {
    return props.msg.meta?.splitLines as string[] | undefined
  })

  // Get the previous user message for reading delay calculation
  const getPreviousUserMessage = createMemo(() => {
    const msgs = msgStore.getState().msgs
    if (!msgs.length) return ''
    
    // Find the most recent user message (not bot message)
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i]
      if (msg.userId && !msg.characterId) {
        return msg.msg || ''
      }
    }
    return ''
  })

  const saveEdit = () => {
    if (props.msg.json) {
      const json = jsonValues()
      const update = getJsonUpdate(
        ctx.preset?.jsonSource === 'character'
          ? ctx.activeMap[props.msg.characterId!]?.json
          : ctx.preset?.json,
        json
      )

      if (update) {
        msgStore.editMessageProp(props.msg._id, update)
      }

      setEdit(false)
      return
    }

    if (!editRef) return

    msgStore.editMessage(props.msg._id, editRef.innerText)
    setEdit(false)
  }

  const cancelEdit = () => setEdit(false)

  const startEdit = () => {
    setEdit(true)
    if (editRef) {
      editRef.innerText = props.msg.msg
    }
    editRef?.focus()
  }

  const alt = createMemo(() => {
    const percent = `${ctx.ui.chatAlternating ?? 0}%`
    return {
      width: `calc(100% - ${ctx.ui.chatAlternating ?? 0}%)`,
      'margin-right': ctx.user?._id === props.msg.userId ? percent : undefined,
      'margin-left': ctx.user?._id !== props.msg.userId ? percent : undefined,
    }
  })

  const imageSpeed = createMemo(() => {
    const next = ctx.waiting?.image ?? 1
    return next
  })

  const createImage = () => {
    msgStore.createImage(props.msg.msg)
    showOpt[1](false)
  }

  return (
    <div
      class={'flex w-full rounded-md px-2 py-2 pr-2 sm:px-4'}
      data-sender={props.msg.characterId ? 'bot' : 'user'}
      data-bot={props.msg.characterId ? ctx.char?.name : ''}
      data-user={props.msg.userId ? state.memberIds[props.msg.userId]?.handle : props.msg.name}
      data-last={props.last?.toString()}
      data-lastsplit="true"
      style={true ? {} : alt()}
      classList={{
        'bg-chat-bot': !props.msg.ooc && !props.msg.userId,
        'bg-chat-user': !props.msg.ooc && !!props.msg.userId,
        'bg-chat-ooc': !!props.msg.ooc,
        unblur: showOpt[0](),
      }}
    >
      <div class={`flex w-full`} classList={{ 'opacity-50': !!props.msg.ooc }}>
        <div class={`flex h-fit w-full select-text flex-col gap-1`}>
          <div class="break-words">
            <Show when={showCharacterInfo()}>
              <span
                class={`float-left pr-3`}
                style={{ 'min-height': user.ui.imageWrap ? '' : img() }}
                data-bot-avatar={isBot}
                data-user-avatar={isUser}
              >
                <Switch>
                  <Match when={user.ui.avatarSize === 'hide'}>{null}</Match>
                  <Match when={props.msg.event === 'world' || props.msg.event === 'ooc'}>
                    <div
                      class={`avatar-${format().size} flex shrink-0 items-center justify-center pt-3`}
                    >
                      <Zap />
                    </div>
                  </Match>

                  <Match when={props.voice === 'generating'}>
                    <div class="animate-pulse cursor-pointer" onClick={msgStore.stopSpeech}>
                      <AvatarIcon format={format()} Icon={DownloadCloud} />
                    </div>
                  </Match>

                  <Match when={props.voice === 'playing'}>
                    <div class="animate-pulse cursor-pointer" onClick={msgStore.stopSpeech}>
                      <AvatarIcon format={format()} Icon={PauseCircle} bot />
                    </div>
                  </Match>

                  <Match when={ctx.allBots[props.msg.characterId!]}>
                    <CharacterAvatar
                      char={ctx.allBots[props.msg.characterId!]}
                      format={format()}
                      openable
                      bot
                      zoom={1.75}
                    />
                  </Match>

                  <Match when={!props.msg.characterId}>
                    <AvatarIcon
                      format={format()}
                      Icon={DownloadCloud}
                      avatarUrl={state.memberIds[props.msg.userId!]?.avatar}
                      anonymize={ctx.anonymize}
                    />
                  </Match>

                  <Match when>
                    <AvatarIcon
                      format={format()}
                      Icon={DownloadCloud}
                      avatarUrl={state.memberIds[props.msg.userId!]?.avatar}
                      anonymize={ctx.anonymize}
                    />
                  </Match>
                </Switch>
              </span>
            </Show>
            <span class="flex flex-row justify-between pb-1">
              <Show when={showCharacterInfo()}>
                <span
                  class={`flex min-w-0 shrink flex-row items-baseline gap-1 overflow-hidden`}
                  classList={{
                    italic: props.msg.ooc,
                  }}
                >
                  <b
                    class={`chat-name text-900 max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap sm:max-w-[400px]`}
                    // Necessary to override text-md and text-lg's line height, for proper alignment
                    style="line-height: 1;"
                    data-bot-name={isBot}
                    data-user-name={isUser}
                    classList={{
                      hidden: !!props.msg.event,
                      'sm:text-base': props.isPaneOpen,
                      'sm:text-lg': !props.isPaneOpen,
                    }}
                  >
                    {ctx.anonymize && !props.msg.characterId
                      ? getAnonName(props.msg.userId!)
                      : props.msg.handle}
                  </b>

                  <span
                    classList={{ invisible: ctx.anonymize }}
                    class={`message-date text-600 flex items-center text-xs leading-none`}
                    data-bot-time={isBot}
                    data-user-time={isUser}
                  >
                    {new Date(props.msg.createdAt).toLocaleTimeString('en-US', { 
                      hour12: false, 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                    <Show when={isUser && !props.msg.ooc}>
                      <span class="ml-1 flex items-center">
                        <Show 
                          when={messageRead()}
                          fallback={
                            <Show when={messageSent()}>
                              <Check 
                                size={12} 
                                class="text-gray-400" 
                              />
                            </Show>
                          }
                        >
                          <CheckCheck 
                            size={12} 
                            class="text-blue-500" 
                          />
                        </Show>
                      </span>
                    </Show>
                    <Show when={ctx.flags.debug}>
                      <tr>
                        <td class="pr-2">
                          <b>id</b>
                        </td>
                        <td>
                          id:{props.msg._id.slice(0, 4)} up:{props.msg.parent?.slice(0, 4)}
                        </td>
                      </tr>
                    </Show>
                  </span>
                </span>
              </Show>
              <Switch>
                <Match
                  when={
                    !edit() &&
                    !props.swipe &&
                    user.user?._id === ctx.chat?.userId &&
                    ctx.chat?.mode !== 'companion'
                  }
                >
                  <Show when={showCharacterInfo()}>
                    <MessageOptions
                      index={props.index}
                      ui={user.ui}
                      msg={props.msg}
                      edit={edit}
                      startEdit={startEdit}
                      onRemove={props.onRemove}
                      last={props.last}
                      tts={!!props.tts}
                      partial={props.partial}
                      show={opts}
                      showMore={showOpt}
                      textBeforeGenMore={props.textBeforeGenMore}
                    />
                  </Show>
                </Match>

                <Match when={edit()}>
                  <Show when={showCharacterInfo()}>
                    <div class="cancel-edit-btn mr-4 flex items-center gap-4 text-sm">
                      <div class="icon-button text-red-500" onClick={cancelEdit}>
                        <X size={22} />
                      </div>
                      <div class="confirm-edit-btn icon-button text-green-500" onClick={saveEdit}>
                        <Check size={22} />
                      </div>
                    </div>
                  </Show>
                </Match>

                <Match when={props.last && props.swipe}>
                  <Show when={showCharacterInfo()}>
                    <div class="mr-4 flex items-center gap-4 text-sm">
                      <div
                        class="icon-button text-red-500"
                        onClick={props.discardSwipe}
                        title="Discard"
                      >
                        <Delete size={22} />
                      </div>
                      <div
                        class="icon-button text-red-500"
                        onClick={props.cancelSwipe}
                        title="Cancel"
                      >
                        <X size={22} />
                      </div>
                      <div
                        class="icon-button text-green-500"
                        onClick={props.confirmSwipe}
                        title="Select"
                      >
                        <Check size={22} />
                      </div>
                    </div>
                  </Show>
                </Match>
              </Switch>
            </span>
            <div ref={avatarRef} classList={{ 'overflow-hidden': !user.ui.imageWrap }}>
              
              <Switch>
                <Match when={props.msg.adapter === 'image'}>
                  <MessageImages msg={props.msg} />
                </Match>

                <Match when={!edit()}>
                  <Show 
                    when={shouldUseLineByLine()}
                    fallback={
                      <>
                        <p
                          class={`rendered-markdown pr-1 ${content().class}`}
                          data-bot-message={!props.msg.userId}
                          data-user-message={!!props.msg.userId}
                          innerHTML={content().message}
                        />
                        <Show when={content().generating}>
                          <span class="flex h-8 w-12 items-center justify-center">
                            <span class="dot-flashing bg-[var(--hl-700)]"></span>
                          </span>
                        </Show>
                      </>
                    }
                  >
                    <LineByLineRenderer
                      content={parseMessage(props.msg.msg, ctx, !!props.msg.userId, props.msg.adapter)}
                      isBot={!props.msg.userId}
                      isUser={!!props.msg.userId}
                      delay={user.ui.lineByLineDelay ?? 800}
                      onComplete={() => {}}
                      onFirstLine={() => {
                        setShowCharacterInfo(true)
                      }}
                      userMessage={getPreviousUserMessage()}
                      messageId={props.msg._id}
                      existingSplitLines={getExistingSplitLines()}
                    />
                  </Show>

                  {/* MessageImages now handles the flex layout for images, loader, and add button */}
                  <MessageImages msg={props.msg}>
                    {/* Show loader placeholder for a NEWLY generating image for THIS message */}
                    <Show when={ctx.waiting?.image && ctx.waiting.messageId === props.msg._id}>
                      <div class="mt-2 h-32 w-32 rounded-md border border-dashed border-neutral-600 flex flex-col items-center justify-center p-2">
                        <RelativeSpinner speed={imageSpeed()} />
                        <Show when={ctx.status && ctx.status.wait_time && parseFloat(String(ctx.status.wait_time)) > 0}>
                          <span class="text-500 text-xs italic mt-1">
                            {ctx.status!.wait_time}s
                          </span>
                        </Show>
                      </div>
                    </Show>

                    {/* "Add Image" button/placeholder */}
                    <Show when={!content().generating && !!props.msg.characterId && !props.msg.system && !props.msg.event && props.msg.adapter !== 'image' && (props.msg.extras && props.msg.extras.length > 0) && (!ctx.waiting?.image || ctx.waiting.messageId !== props.msg._id)}>
                      <div
                        class="icon-button mt-2 flex h-32 w-32 items-center justify-center rounded-md border border-dashed border-neutral-600"
                        title="Add another image"
                        onClick={() => msgStore.createImage(props.msg._id, true)}
                      >
                        <ImagePlus size={24} />
                      </div>
                    </Show>
                  </MessageImages>

                  <Show when={!props.partial && props.last}>
                    <div class="flex items-center justify-center gap-2">
                      <For each={props.msg.actions}>
                        {(item) => (
                          <Button
                            size="sm"
                            schema="gray"
                            onClick={() => sendAction(props.sendMessage, item)}
                          >
                            {item.emote}
                          </Button>
                        )}
                      </For>
                    </div>
                  </Show>
                </Match>

                <Match when={edit() && props.msg.json}>
                  <JsonEdit msg={props.msg} update={(next) => setJsonValues(next)} />
                </Match>
                <Match when={edit()}>
                  <div
                    class="msg-edit-text-box"
                    ref={editRef!}
                    contentEditable={true}
                    onKeyUp={(ev) => {
                      if (ev.key === 'Escape') cancelEdit()
                      if (ev.altKey && ev.key === 's') {
                        ev.preventDefault()
                        saveEdit()
                      }
                    }}
                  ></div>
                </Match>
              </Switch>
            </div>
          </div>
          <Show when={!edit()}>{props.last && props.children}</Show>
        </div>
      </div>
    </div>
  )
}

export default Message

export type SplitMessage = AppSchema.ChatMessage & { split?: boolean; handle?: string }

function anonymizeText(text: string, profile: AppSchema.Profile, i: number) {
  return text.replace(new RegExp(profile.handle.trim(), 'gi'), 'User ' + (i + 1))
}

const JsonEdit: Component<{
  msg: SplitMessage
  update: (next: any) => void
}> = (props) => {
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

const MessageOptions: Component<{
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
}> = (props) => {
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

function renderMessage(ctx: ContextState, text: string, isUser: boolean, adapter?: string) {
  // Address unfortunate Showdown bug where spaces in code blocks are replaced with nbsp, except
  // it also encodes the ampersand, which results in them actually being rendered as `&amp;nbsp;`
  // https://github.com/showdownjs/showdown/issues/669

  const html = Purify.sanitize(
    wrapWithQuoteElement(
      markdown.makeHtml(parseMessage(text, ctx, isUser, adapter)).replace(/&amp;nbsp;/g, '&nbsp;')
    )
  )

  return html
}

function wrapWithQuoteElement(str: string) {
  return str.replace(
    // we first match code blocks AND html tags
    // to ensure we do NOTHING to what's inside them
    /<[\s\S]*?>|```[\s\S]*?```|``[\s\S]*?``|`[\s\S]*?`|(\".+?\")|(\u201C.+?\u201D)/gm,
    wrapCaptureGroups
  )
}

/** For use as a String#replace(str, cb) callback */
function wrapCaptureGroups(
  match: string,
  regularQuoted?: string /** regex capture group 1 */,
  curlyQuoted?: string /** regex capture group 2 */
) {
  if (regularQuoted) {
    return '<q>"' + regularQuoted.replace(/\"/g, '') + '"</q>'
  } else if (curlyQuoted) {
    return '<q>" ' + curlyQuoted.replace(/\u201C|\u201D/g, '') + ' "</q>'
  } else {
    return match
  }
}

function sendAction(_send: MessageProps['sendMessage'], { emote, action }: AppSchema.ChatAction) {
  events.emit(EVENTS.setInputText, action)
}

function parseMessage(msg: string, ctx: ContextState, isUser: boolean, adapter?: string) {
  if (adapter === 'image') {
    return msg.replace(BOT_REPLACE, ctx.char?.name || '').replace(SELF_REPLACE, ctx.handle)
  }

  const parsed = msg.replace(BOT_REPLACE, ctx.char?.name || '').replace(SELF_REPLACE, ctx.handle)
  return parsed
}

const Meta: Component<{
  msg: AppSchema.ChatMessage
  history?: any
  flags: FeatureFlags
  tree: ChatTree
}> = (props) => {
  if (!props.msg) return null
  const [prompt, setPrompt] = createSignal(props.msg?.imagePrompt || '')

  const updateImagePrompt = () => {
    msgStore.editMessageProp(props.msg._id, { imagePrompt: prompt() }, () => {
      toastStore.success('Image prompt updated')
    })
  }

  const descendants = createMemo(() => {
    const self = props.tree[props.msg._id]
    if (!self) return []

    return Array.from(self.children.values())
  })

  const depth = props.tree[props.msg._id]?.depth || -1

  return (
    <form class="flex w-full flex-col gap-2">
      <Card>
        <LogProbs msg={props.msg} />
        <table class="text-sm">
          <Show when={props.msg.adapter}>
            <tr>
              <td class="pr-2">
                <b>Adapter</b>
              </td>
              <td>{props.msg.adapter}</td>
            </tr>
          </Show>
          <Show when={depth >= 0}>
            <tr>
              <td>
                <b>depth</b>
              </td>
              <td>#{depth + 1}</td>
            </tr>
          </Show>
          <Show when={descendants().length > 0 && props.flags.debug}>
            <tr>
              <td>
                <b>descendants</b>
              </td>
              <td>
                {descendants()
                  .map((d) => d.slice(0, 4))
                  .join(', ')}
              </td>
            </tr>
          </Show>
          <For each={Object.entries(props.msg.meta || {}).filter(([key]) => key !== 'probs')}>
            {([key, value]) => (
              <tr>
                <td class="pr-2">
                  <b>{key}</b>
                </td>
                <td>{value as string}</td>
              </tr>
            )}
          </For>
        </table>
      </Card>

      <Show when={props.msg.imagePrompt}>
        <Card>
          <TextInput
            helperText={
              <>
                Image Prompt -{' '}
                <span class="link" onClick={updateImagePrompt}>
                  Save
                </span>
              </>
            }
            parentClass="text-sm"
            isMultiline
            value={prompt()}
            onChange={(ev) => setPrompt(ev.currentTarget.value)}
          />
        </Card>
      </Show>

      <Show when={props.history}>
        <pre class="overflow-x-auto whitespace-pre-wrap break-words rounded-sm bg-[var(--bg-700)] p-1 text-sm">
          <Show
            when={typeof props.history === 'string'}
            fallback={JSON.stringify(props.history, null, 2)}
          >
            {props.history}
          </Show>
        </pre>
      </Show>
    </form>
  )
}

function canShowMeta(msg: AppSchema.ChatMessage, history: any) {
  if (!msg) return false
  if (msg._id === 'partial-response') return false
  return !!msg.adapter || !!history || (!!msg.meta && Object.keys(msg.meta).length >= 1)
}

function getMessageContent(ctx: ContextState, props: MessageProps, state: ChatState) {
  const isRetry = props.retrying?._id === props.msg._id
  const isPartial = props.msg._id === 'partial-response'

  if (isRetry || isPartial) {
    if (props.partial) {
      return {
        type: 'partial',
        message: renderMessage(ctx, props.partial!, false, 'partial'),
        class: 'streaming-markdown',
        generating: true,
      }
    }

    if (isPartial && props.msg.msg) {
      return {
        type: 'partial',
        message: renderMessage(ctx, props.msg.msg, false, 'partial'),
        class: 'streaming-markdown',
        generating: true,
      }
    }

    return { type: 'waiting', message: '', class: 'not-streaming', generating: true }
  }

  let message = props.msg.msg

  if (props.last && props.swipe) message = props.swipe
  if (props.msg.event && !props.showHiddenEvents) {
    message = message.replace(/\(OOC:.+\)/, '')
  }

  if (ctx.anonymize) {
    message = state.chatProfiles.reduce(anonymizeText, message).replace(SELF_REPLACE, 'User #1')
  }

  if (ctx.trimSentences && !props.msg.userId) {
    message = trimSentence(message)
  }

  return {
    type: 'message',
    message: renderMessage(ctx, message, !!props.msg.userId, props.msg.adapter),
    class: 'not-streaming',
  }
}

function getJsonUpdate(def: AppSchema.Character['json'], json: any) {
  if (!def) return
  const hydration = hydrateTemplate(def, json)

  return {
    json: hydration,
    msg: hydration.response,
  }
}