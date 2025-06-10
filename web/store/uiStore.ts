import Values from 'values.js'
import { createStore } from './create'
import { createDebounce, storage } from '../shared/util'
import { FileInputResult } from '../shared/FileInput'
import { toastStore } from './toasts'
import { getUserId } from './api'
import { UI } from '/common/types'
import { UISettings, defaultUIsettings } from '/common/types/ui'
import {
  getColorShades,
  getRootVariable,
  getSettingColor,
  hexToRgb,
  setRootVariable,
} from '../shared/colors'
import { usersApi } from './data/user'

const BACKGROUND_KEY = 'ui-bg'

const fontFaces: { [key in UI.FontSetting]: string } = {
  lato: 'Lato, sans-serif',
  default: 'unset',
}

const [debouceUI] = createDebounce((update: UI.UISettings) => {
  updateTheme(update)
}, 50)

export type UIState = {
  ui: UI.UISettings
  current: UI.CustomUI
  background?: string
}

export const uiStore = createStore<UIState>(
  'ui',
  initUIState()
)((get, set) => {
  storage.getItem(BACKGROUND_KEY).then((bg) => {
    if (!bg) return
    set({ background: bg })
  })

  return {
    async saveUI({ ui }, update: Partial<UI.UISettings>) {
      const next: UI.UISettings = { ...ui, ...update }
      const mode = next.mode
      const current = next[next.mode]

      await usersApi.updateUI({ ...next, [mode]: current })

      try {
        await updateTheme({ ...next, [mode]: current })
      } catch (e: any) {
        toastStore.error(`Failed to save UI settings: ${e.message}`)
      }

      return { ui: next, current, [mode]: current }
    },

    async saveCustomUI({ ui }, update: Partial<UI.CustomUI>) {
      const current = { ...ui[ui.mode], ...update }
      const next = { ...ui, [ui.mode]: current }
      await usersApi.updateUI(next)

      try {
        await updateTheme(next)
      } catch (e: any) {
        toastStore.error(`Failed to save UI settings: ${e.message}`)
      }

      return { ui: next, current }
    },

    async tryCustomUI({ ui }, update: Partial<UI.CustomUI>) {
      const prop = ui.mode === 'light' ? 'light' : 'dark'
      const current = { ...ui[prop], ...update }
      const next = { ...ui, current, [prop]: current }
      await updateTheme(next)
      return next
    },

    tryUI({ ui }, update: Partial<UI.UISettings>) {
      const mode = update.mode || ui.mode
      const current = ui[mode]
      const next = { current, ...ui, ...update }
      debouceUI(next)
      return { ui: next }
    },

    async receiveUI({ ui }, update: UI.UISettings) {
      const current = update[update.mode]
      await updateTheme(update)

      // Ensure msgOptsInline exists on update, using a copy of defaults if not, or an empty object as a fallback.
      if (!update.msgOptsInline) {
        update.msgOptsInline = { ...defaultUIsettings.msgOptsInline };
      } else {
        // Ensure it's a fresh object for modification if it exists to avoid issues with frozen objects.
        update.msgOptsInline = { ...update.msgOptsInline };
      }

      const defaultMsgOpts = defaultUIsettings.msgOptsInline;
      const userMsgOpts = update.msgOptsInline;

      // Iterate over default options to add missing ones or update positions.
      for (const key in defaultMsgOpts) {
        const optKey = key as UI.MessageOption;
        if (userMsgOpts[optKey]) {
          // If user has the option, update its position to the default position.
          // Keep user's 'outer' preference.
          userMsgOpts[optKey] = {
            outer: userMsgOpts[optKey].outer, // Preserve user's outer setting
            pos: defaultMsgOpts[optKey].pos    // Enforce default position
          };
        } else {
          // If user doesn't have the option, add it from defaults.
          userMsgOpts[optKey] = { ...defaultMsgOpts[optKey] };
        }
      }

      // Iterate over user's options to remove any that are no longer in defaults.
      for (const key in userMsgOpts) {
        const optKey = key as UI.MessageOption;
        if (!defaultMsgOpts[optKey]) {
          delete userMsgOpts[optKey];
        }
      }

      // Fallback for ensuring all top-level UI settings from defaults are present.
      for (const key in defaultUIsettings) {
        if (key as keyof UISettings === 'msgOptsInline') continue; // Already handled
        if (update[key as keyof UISettings] === undefined) {
          update[key as keyof UISettings] = defaultUIsettings[key as keyof UISettings] as never;
        }
      }

      return { ui: { ...ui, ...update }, current }
    },

    setBackground(_, file: FileInputResult | null) {
      try {
        if (!file) {
          setBackground(null)
          return { background: undefined }
        }

        setBackground(file.content)
        return { background: file.content }
      } catch (e: any) {
        toastStore.error(`Failed to set background: ${e.message}`)
      }
    },
  }
})

function initUIState(): UIState {
  const ui = getUIsettings()
  updateTheme(ui)

  return {
    ui,
    background: undefined,
    current: ui[ui.mode] || UI.defaultUIsettings[ui.mode],
  }
}

async function updateTheme(ui: UI.UISettings) {
  storage.localSetItem(getUIKey(), JSON.stringify(ui))
  const root = document.documentElement

  const mode = ui[ui.mode]

  const hex = mode.bgCustom || getSettingColor('--bg-800')
  const colors = mode.bgCustom
    ? new Values(`${hex}`)
        .all(14)
        .map(({ hex }) => '#' + hex)
        .reverse()
    : []

  if (ui.mode === 'dark') {
    colors.reverse()
  }

  const gradients = ui.bgCustomGradient ? getColorShades(ui.bgCustomGradient) : []

  const notifies = Object.entries({
    info: 'sky',
    success: 'green',
    warning: 'premium',
    error: 'red',
  })

  for (let shade = 100; shade <= 1000; shade += 100) {
    const index = shade / 100 - 1
    const num = ui.mode === 'light' ? 1000 - shade : shade

    if (shade <= 900) {
      for (const [notify, source] of notifies) {
        const color = getRootVariable(`--${source}-${num}`)
        root.style.setProperty(`--${notify}-${num}`, color)
      }

      const color = getRootVariable(`--${ui.theme}-${num}`)
      const colorRgb = hexToRgb(color)
      root.style.setProperty(`--hl-${shade}`, color)
      root.style.setProperty(`--rgb-hl-${shade}`, `${colorRgb?.rgb}`)

      const text = getRootVariable(`--truegray-${900 - (num - 100)}`)
      const textRgb = hexToRgb(text)
      root.style.setProperty(`--text-${shade}`, text)
      root.style.setProperty(`--rgb-text-${shade}`, `${textRgb?.rgb}`)
    }

    const bg = getRootVariable(`--${ui.themeBg}-${num}`)
    const bgValue = colors.length ? colors[index] : bg
    const bgRgb = hexToRgb(getSettingColor(bgValue))
    const gradient = getSettingColor(gradients.length ? colors[index] : bg)

    root.style.setProperty(`--bg-${shade}`, bgValue)
    root.style.setProperty(`--gradient-${shade}`, gradient)
    root.style.setProperty(`--gradient-bg-${shade}`, `linear-gradient(${bgValue}, ${gradient})`)
    root.style.setProperty(`--rgb-bg-${shade}`, `${bgRgb?.rgb}`)
  }

  setRootVariable('text-chatcolor', getSettingColor(mode.chatTextColor || 'text-800'))
  setRootVariable('text-emphasis-color', getSettingColor(mode.chatEmphasisColor || 'text-600'))
  setRootVariable('text-quote-color', getSettingColor(mode.chatQuoteColor || 'text-800'))
  setRootVariable('bot-background', getSettingColor(mode.botBackground || 'bg-800'))
  root.style.setProperty(`--sitewide-font`, fontFaces[ui.font])
}

function getUIsettings(guest = false) {
  const key = getUIKey(guest)
  const json =
    storage.localGetItem(key) ||
    storage.localGetItem('ui-settings') ||
    JSON.stringify(UI.defaultUIsettings)

  const settings: UI.UISettings = JSON.parse(json)
  const theme = (storage.localGetItem('theme') || settings.theme) as UI.ThemeColor
  storage.removeItem('theme')

  if (theme && UI.UI_THEME.includes(theme)) {
    settings.theme = theme
  }

  const ui = { ...UI.defaultUIsettings, ...settings }

  if (!ui.dark.chatEmphasisColor) {
    ui.dark.chatQuoteColor = UI.defaultUIsettings.dark.chatQuoteColor
    ui.light.chatQuoteColor = UI.defaultUIsettings.light.chatQuoteColor
  }

  if (!ui.msgOptsInline) {
    ui.msgOptsInline = UI.defaultUIsettings.msgOptsInline
  }

  return ui
}

async function setBackground(content: any) {
  if (content === null) {
    await storage.removeItem(BACKGROUND_KEY)
    return
  }

  await storage.setItem(BACKGROUND_KEY, content)
}

function getUIKey(guest = false) {
  const userId = guest ? 'anon' : getUserId()
  return `ui-settings-${userId}`
}