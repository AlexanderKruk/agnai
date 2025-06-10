import { Component, createEffect, createMemo, createSignal, onMount, Show } from 'solid-js'
import { Save, X } from 'lucide-solid'
import Button from '../../shared/Button'
import { FileInputResult } from '../../shared/FileInput'
import {
  characterStore,
  tagStore,
  toastStore,
  chatStore,
  userStore,
  settingStore,
} from '../../store'
import { useNavigate, useSearchParams } from '@solidjs/router'
import { AppSchema } from '../../../common/types/schema'
import { JSX } from 'solid-js'
import { TitleCard } from '../../shared/Card'
import { usePane } from '../../shared/hooks'
import { useCharEditor } from './editor'
import { downloadCharacterHub, jsonToCharacter } from './port'
import Tabs, { useTabs } from '/web/shared/Tabs'
import { imageApi } from '/web/store/data/image'
import { Page } from '/web/Layout'
import { canStartTour, startTour } from '/web/tours'
import { AdvancedOptions } from './form/AdvancedOptions'

// Import our extracted components
import { PersonaTab } from './components/PersonaTab'
import { VoiceTab } from './components/VoiceTab'
import { ImagesTab } from './components/ImagesTab'
import { FormHeader } from './components/FormHeader'
import { FormModals } from './components/FormModals'


export const CreateCharacterForm: Component<{
  chat?: AppSchema.Chat
  editId?: string
  duplicateId?: string
  import?: string
  children?: JSX.Element
  temp?: boolean
  noTitle?: boolean
  footer?: (children: JSX.Element) => void
  close?: () => void
  onSuccess?: (char: AppSchema.Character) => void
}> = (props) => {
  let spriteRef: any

  const [search, setSearch] = useSearchParams()
  const nav = useNavigate()
  const user = userStore()

  const isPage = props.close === undefined

  const paneOrPopup = usePane()
  const cancel = () => {
    if (isPage) {
      nav('/character/list')
    } else {
      props.close?.()
    }
  }
  const query = { import: props.import }
  const [forceNew, setForceNew] = createSignal<boolean>(false)

  const srcId = createMemo(() => props.editId || props.duplicateId || '')
  const [image, setImage] = createSignal<string | undefined>()
  const [openPreset, setOpenPreset] = createSignal(false)
  const [presetFooter, setPresetFooter] = createSignal<JSX.Element>()

  const editor = useCharEditor()

  const tagState = tagStore()
  const state = characterStore((s) => {
    const edit = s.editing

    return {
      creating: s.creating,
      edit: forceNew() ? undefined : edit,
      list: s.characters.list,
      loaded: s.characters.loaded,
    }
  })

  const [, setImageUrl] = createSignal<string>()

  const [tokens, setTokens] = createSignal({
    name: 0,
    scenario: 0,
    greeting: 0,
    persona: 0,
    sample: 0,
  })

  const [showBuilder, setShowBuilder] = createSignal(false)
  const [converted, setConverted] = createSignal<AppSchema.Character>()
  const [showImport, setImport] = createSignal(false)
  const [showAvatar, setShowAvatar] = createSignal(false)

  const clearEditor = () => {
    setForceNew(true)
    editor.clear()
  }


  const totalTokens = createMemo(() => {
    const t = tokens()
    return t.name + t.persona + t.sample + t.scenario
  })

  const totalPermanentTokens = createMemo(() => {
    const t = tokens()
    return t.name + t.persona + t.scenario
  })

  onMount(async () => {
    characterStore.clearGeneratedAvatar()
    characterStore.clearCharacter()

    if (canStartTour('char')) {
      settingStore.closeMenu()
    }

    startTour('char')

    if (srcId()) {
      characterStore.getCharacter(srcId(), props.chat)
    }

    /* Character importing from CharacterHub */
    if (!query.import) return
    try {
      const { file, json } = await downloadCharacterHub(query.import)
      const imageData = await imageApi.getImageData(file)
      const char = jsonToCharacter(json)
      await editor.load(char)
      editor.update({
        book: json.characterBook,
        alternateGreetings: json.alternateGreetings || [],
        avatar: file,
        personaKind: 'text',
      })
      editor.receiveAvatar(file)

      setImage(imageData)
      toastStore.success(`Successfully downloaded from Character Hub`)
    } catch (ex: any) {
      toastStore.error(`Character Hub download failed: ${ex.message}`)
    }
  })

  createEffect(async () => {
    // We know we're waiting for a character to edit, so let's just wait
    if (!state.edit && srcId()) return

    // If this is our first pass: load something no matter what
    if (!editor.original()) {
      if (!srcId()) {
        await editor.loadCached()
        return
      }

      // We have a `srcId`, we need to wait to receive the character we're editing
      if (!state.edit) return

      await editor.load(state.edit)
      setImage(state.edit?.avatar)
      return
    }

    // This is a subsequent pass - we already have state
    // We want to avoid unnecessarily clearing/reseting state due to a websocket reconnect

    if (!state.edit) return
    if (editor.state.editId !== state.edit._id && state.edit._id === srcId()) {
      editor.update('editId', srcId())
      await editor.load(state.edit)
      setImage(state.edit?.avatar)
      return
    }
  })

  createEffect(() => {
    tagStore.updateTags(state.list)
    props.footer?.(footer)
  })

  const updateFile = async (files: FileInputResult[]) => {
    if (!files.length) {
      editor.update('avatar', undefined)
      setImage(state.edit?.avatar)
      return
    }

    const file = files[0].file
    const data = await editor.receiveAvatar(file)
    setImage(data)
  }

  const onSubmit = async (ev: Event) => {
    const payload = editor.payload(true)

    if (props.temp && props.chat) {
      if (editor.state.avatar) {
        const data = await imageApi.getImageData(editor.state.avatar)
        payload.avatar = data
      }
      chatStore.upsertTempCharacter(props.chat._id, { ...payload, _id: props.editId }, (result) => {
        props.onSuccess?.(result)
        if (paneOrPopup() === 'popup') props.close?.()
      })
    } else if (!forceNew() && props.editId) {
      characterStore.editFullCharacter(props.editId, payload, () => {
        if (isPage) {
          nav(`/character/${props.editId}/chats`)
        } else if (paneOrPopup() === 'popup') {
          props.close?.()
        }
      })
    } else {
      characterStore.createCharacter(payload, (result) => {
        editor.update('editId', result._id)
        setForceNew(false)
        if (isPage) nav(`/character/${result._id}/chats`)
      })
    }
  }

  const footer = (
    <>
      <Button onClick={cancel} schema="secondary">
        <X />
        {props.close ? 'Close' : 'Cancel'}
      </Button>
      <Button onClick={onSubmit} disabled={state.creating}>
        <Save />
        {props.editId && !forceNew() ? 'Update' : 'Create'}
      </Button>
    </>
  )

  const showWarning = createMemo(
    () => !!props.chat?.overrides && props.chat.characterId === props.editId
  )

  const tabs = useTabs(['Persona', 'Voice', 'Images', 'Advanced'], +(search.char_tab || '0'))

  return (
    <Page
      classList={{
        'p-0': !isPage,
      }}
    >
      <FormHeader
        isPage={isPage}
        paneOrPopup={paneOrPopup}
        forceNew={forceNew}
        showWarning={showWarning}
        totalTokens={totalTokens}
        totalPermanentTokens={totalPermanentTokens}
        noTitle={props.noTitle}
        children={props.children}
        editId={props.editId}
        state={state}
        onPreset={() => setOpenPreset(true)}
        onImport={() => setImport(true)}
        onExport={() => setConverted(editor.convert())}
        onForceNew={() => {
          setForceNew(true)
          editor.clear()
        }}
        onClear={clearEditor}
      />
      
      <form class="relative text-base">
        <div class="flex flex-col gap-4">
          <Show when={props.temp}>
            <TitleCard type="premium">
              You are {props.editId ? 'editing' : 'creating'} a temporary character. A temporary
              character exist within your current chat only.
            </TitleCard>
          </Show>

          <div class={`flex grow flex-col justify-between gap-2`}>
            <Tabs
              select={(id) => {
                tabs.select(id)
                setSearch({ char_tab: id })
              }}
              selected={tabs.selected}
              tabs={tabs.tabs}
            />

            <div classList={{ hidden: tabs.current() !== 'Persona' }}>
              <PersonaTab
                editor={editor}
                user={user}
                tagState={tagState}
                tokens={tokens}
                setTokens={setTokens}
                updateFile={updateFile}
                showBuilder={showBuilder}
                setShowBuilder={setShowBuilder}
                image={image}
                setImageUrl={setImageUrl}
                forceNew={forceNew}
                spriteRef={spriteRef}
              />
            </div>

            <div classList={{ hidden: tabs.current() !== 'Voice' }}>
              <VoiceTab editor={editor} />
            </div>

            <div classList={{ hidden: tabs.current() !== 'Advanced' }}>
              <AdvancedOptions editor={editor} />
            </div>

            <div classList={{ hidden: tabs.current() !== 'Images' }}>
              <ImagesTab />
            </div>

            <Show when={!props.close}>
              <div class="flex w-full justify-end gap-2">{footer}</div>
            </Show>
          </div>
        </div>
      </form>

      <FormModals
        editor={editor}
        openPreset={openPreset}
        setOpenPreset={setOpenPreset}
        presetFooter={presetFooter}
        setPresetFooter={setPresetFooter}
        showBuilder={showBuilder}
        setShowBuilder={setShowBuilder}
        converted={converted}
        setConverted={setConverted}
        showImport={showImport}
        setImport={setImport}
        showAvatar={showAvatar}
        setShowAvatar={setShowAvatar}
        image={image}
        setImage={setImage}
      />
    </Page>
  )
}
