import { Component, createSignal, createMemo, createEffect, onMount, onCleanup, Show } from 'solid-js'
import { markdown } from '/web/shared/markdown'
import { msgStore } from '/web/store/message'
import Purify from 'dompurify'

// Text processing utilities
function splitTextOnEmojisAndEllipsis(text: string): string[] {
  if (!text || text.trim() === '') return []

  // Handle various ellipsis forms and emoji patterns
  const splitPattern = /(?<=[.!?…])\s+(?=[A-Z])|(?<=\.\.\.|…|\.{3,})\s*|(?<=😊|😌|😍|😘|😳|😊|😭|😢|😤|😋|😜|😏|😉|😎|😱|😰|😅|😂|🤣|🥺|🥰|😇|🤔|😆|😄|😀|🙂|🙃|😊|😋|😎|😍|🥳|😘|😗|😙|😚|☺️|🤗|🤩|🤪|😝|😛|😋|😗|😙|😚|😘|😍|🥰|😻|💕|💖|💗|💘|💝|💓|💞|💟|❤️|🧡|💛|💚|💙|💜|🤎|🖤|🤍|💯|💢|💥|💫|💦|💨|🕳️|💬|🗨️|🗯️|💭|💤)/
  
  let parts = text.split(splitPattern).filter(part => part.trim() !== '')
  
  // If no splits occurred or we only have one part, do sentence-level splitting
  if (parts.length <= 1) {
    // Fallback to sentence splitting
    parts = text.split(/(?<=[.!?])\s+/).filter(part => part.trim() !== '')
  }
  
  // If still no good splits, split on double newlines or very long lines
  if (parts.length <= 1) {
    if (text.includes('\n\n')) {
      parts = text.split(/\n\n+/).filter(part => part.trim() !== '')
    } else if (text.length > 200) {
      // For very long single sentences, split on commas or conjunctions
      const longSentenceSplits = text.split(/(?<=,)\s+(?=and|but|or|so|yet|for|nor|because|although|however|meanwhile|furthermore|moreover|therefore|consequently|nevertheless|nonetheless)/i)
      if (longSentenceSplits.length > 1) {
        parts = longSentenceSplits.filter(part => part.trim() !== '')
      }
    }
  }
  
  // Ensure we return at least the original text if no splitting worked
  if (parts.length === 0) {
    parts = [text.trim()]
  }
  
  return parts.map(part => part.trim()).filter(part => part.length > 0)
}

function wrapWithQuoteElement(html: string): string {
  const quoteRegex = /^(&gt;\s*.*?)$/gm
  return html.replace(quoteRegex, '<span class="quote">$1</span>')
}

export interface LineByLineRendererProps {
  content: string
  isBot: boolean
  isUser: boolean
  delay: number
  onComplete?: () => void
  onFirstLine?: () => void
  userMessage?: string
  messageId: string
  existingSplitLines?: string[]
  characterId?: string
  onInterruptReady?: (interruptFn: () => void) => void
}

export const LineByLineRenderer: Component<LineByLineRendererProps> = (props) => {
  const [visibleLines, setVisibleLines] = createSignal(0)
  const [isComplete, setIsComplete] = createSignal(false)
  const [hasStarted, setHasStarted] = createSignal(false)
  const [hasBeenInterrupted, setHasBeenInterrupted] = createSignal(false)
  
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

  // Add interrupt function to handle user typing during line-by-line display
  const interruptRendering = () => {
    if (hasBeenInterrupted() || isComplete()) return;

    // Clear all timers to stop the animation
    clearAllTimers()
    
    const currentLines = lines().slice(0, visibleLines())
    if (currentLines.length === 0) {
      setIsComplete(true)
      setHasBeenInterrupted(true)
      if (props.characterId) {
        msgStore.clearTyping()
      }
      return
    }
    
    // Only save if we've shown at least one line
    const partialMessage = currentLines.join('\n\n')
    
    // Save the partial message to the backend
    msgStore.editMessageProp(props.messageId, {
      msg: partialMessage,
      meta: {
        ...msgStore.getState().msgs.find(m => m._id === props.messageId)?.meta,
        interrupted: true,
        splitLines: currentLines
      }
    })
    
    // Set state to complete to prevent further rendering
    setIsComplete(true)
    setHasBeenInterrupted(true)
    
    // Clear typing indicator
    if (props.characterId) {
      msgStore.clearTyping()
    }
  }
  
  // Expose interrupt function to parent component
  createEffect(() => {
    if (props.onInterruptReady) {
      props.onInterruptReady(interruptRendering)
    }
  })

  // Save split lines to message meta when rendering is complete
  const saveSplitLines = () => {
    if (!props.existingSplitLines || props.existingSplitLines.length === 0) {
      const splitLines = lines()
      if (splitLines.length > 1) {
        // Only save if we actually have multiple lines
        msgStore.editMessageProp(props.messageId, {
          msg: splitLines.join('\n\n'),
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
    // Assume reading speed of ~2 words per second (more realistic)
    const readingTime = (words / 2) * 1000
    
    // Add some randomness and minimum time
    const minReadingTime = 800
    const maxReadingTime = 4000 // Increased for slower reading
    const randomizedTime = readingTime * (0.8 + Math.random() * 0.6) // 0.8x to 1.4x
    
    return Math.max(minReadingTime, Math.min(maxReadingTime, randomizedTime))
  }

  // Calculate thinking delay - time to process and formulate response
  const calculateThinkingDelay = () => {
    // Thinking time varies between 2000-4000ms
    const baseThinking = 1500 // Base thinking time
    const variationRange = 1000 // Additional 0-2000ms
    const complexityFactor = Math.min(lines().length * 0.1, 1.0) // Slight complexity factor
    const randomFactor = Math.random() // 0 to 1 variation
    
    return baseThinking + (variationRange * randomFactor) + (complexityFactor * 500)
  }

  // Calculate dynamic delay based on line length with randomness
  const calculateLineDelay = (lineText: string, baseDelay: number) => {
    // Base calculation: longer lines get longer delays
    const textLength = lineText.length
    const wordsCount = lineText.split(/\s+/).length
    
    // Base delay calculation based on reading speed
    // Assume ~2 words per second reading speed, plus time for "typing"
    const readingTime = (wordsCount / 2) * 1000 // milliseconds
    const typingTime = textLength * 40 // ~40ms per character typing simulation
    
    // Combine reading and typing time, but use baseDelay as minimum
    const calculatedDelay = Math.max(baseDelay * 0.5, readingTime + typingTime)
    
    // Add randomness on the bigger side (20% to 60% additional time)
    const randomMultiplier = 1 + (Math.random() * 0.4 + 0.2) // 1.2x to 1.6x
    const finalDelay = calculatedDelay * randomMultiplier
    
    // No cap - let realistic typing times work as intended
    return finalDelay
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
      const baseThinkingDelay = dynamicDelay * 0.3 // 30% for thinking
      const baseTypingDelay = dynamicDelay * 0.7 // 70% for typing (since typing is now slower)
      
      // Add randomness to thinking phase (±40% variation)
      const thinkingRandomness = 0.6 + (Math.random() * 0.8) // 0.6x to 1.4x multiplier
      const thinkingDelay = baseThinkingDelay * thinkingRandomness
      
      // Use typing delay directly (already includes 100ms per character calculation)
      const typingDelay = baseTypingDelay
      
      // Phase 1: Thinking delay - show thinking indicator
      if (props.characterId) {
        msgStore.setTyping(props.characterId, props.messageId, 'thinking')
      }
      
      addTimer(setTimeout(() => {
        // Phase 2: Show typing indicator and "type"
        if (props.characterId) {
          msgStore.setTyping(props.characterId, props.messageId, 'typing')
        }
        
        addTimer(setTimeout(() => {
          setVisibleLines(prev => prev + 1)
          // Clear typing indicator when line is displayed
          if (props.characterId) {
            msgStore.clearTyping()
          }
        }, typingDelay))
      }, thinkingDelay))

      // Cleanup function for this effect run
      onCleanup(clearAllTimers)
    } else if (hasStarted() && visibleLines() >= lines().length && !isComplete()) {
      setIsComplete(true)
      // Clear typing indicator when complete
      if (props.characterId) {
        msgStore.clearTyping()
      }
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
        props.onFirstLine?.() // Show character info immediately for existing splits
        props.onComplete?.()
        return
      }

      const readingDelay = calculateReadingDelay(props.userMessage || '')
      const thinkingDelay = calculateThinkingDelay()
      
      // Show initial thinking indicator
      if (props.characterId) {
        msgStore.setTyping(props.characterId, props.messageId, 'thinking')
      }
      
      // Phase 1: Reading + thinking delay, then start displaying
      addTimer(setTimeout(() => {
        setHasStarted(true)
        setVisibleLines(1)
        // Show character info when first line is displayed
        props.onFirstLine?.()
        // Clear typing after showing first line
        if (props.characterId) {
          msgStore.clearTyping()
        }
      }, readingDelay + thinkingDelay))
    }
  })

  // Cleanup all timers when component unmounts
  onCleanup(() => {
    clearAllTimers()
    // Clear typing indicator when component unmounts
    if (props.characterId) {
      msgStore.clearTyping()
    }
  })

  return (
    <Show when={hasStarted()}>
      <p
        class="rendered-markdown pr-1 streaming-markdown text-lg sm:text-base"
        data-bot-message={props.isBot}
        data-user-message={props.isUser}
        innerHTML={renderedContent()}
      />
    </Show>
  )
}