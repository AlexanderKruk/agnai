import { Component, Show } from 'solid-js'
import { Plus, X, Import, Download, SlidersVertical } from 'lucide-solid'
import Button from '../../../shared/Button'
import PageHeader from '../../../shared/PageHeader'
import { SolidCard } from '../../../shared/Card'
import { startTour } from '../../../tours'
import { settingStore } from '../../../store'

export interface FormHeaderProps {
  isPage: boolean
  paneOrPopup: () => string | undefined
  forceNew: () => boolean
  showWarning: () => boolean
  totalTokens: () => number
  totalPermanentTokens: () => number
  noTitle?: boolean
  children?: any
  editId?: string
  state: {
    edit?: any
  }
  onPreset: () => void
  onImport: () => void
  onExport: () => void
  onForceNew: () => void
  onClear: () => void
}

export const FormHeader: Component<FormHeaderProps> = (props) => {
  return (
    <>
      <Show when={!props.noTitle && (props.isPage || props.paneOrPopup() === 'pane')}>
        <PageHeader
          title={`${
            props.forceNew() ? 'Create' : props.editId ? 'Edit' : 'Create'
          } a Character`}
          subtitle={
            <>
              <div class="whitespace-normal">
                <em>
                  {props.totalTokens()} tokens, {props.totalPermanentTokens()} permanent
                </em>
              </div>
              <Button size="pill" class="w-fit" onClick={() => startTour('char', true)}>
                AI Character Generation Guide
              </Button>
            </>
          }
        />
      </Show>

      <Show when={!props.isPage}>
        <div> {props.children} </div>
      </Show>

      <Show when={props.showWarning()}>
        <SolidCard bg="orange-600">
          <b>Warning!</b> Your chat currently overrides your character definitions. These
          changes won't affect your current chat until you disable them in the "Edit Chat" menu.
        </SolidCard>
      </Show>

      <Show when={!props.isPage && props.paneOrPopup() === 'popup'}>
        <div>
          <em>
            ({props.totalTokens()} tokens, {props.totalPermanentTokens()} permanent)
          </em>
        </div>
      </Show>

      <div class="flex justify-end gap-2 text-[1em]">
        <Button onClick={props.onPreset} class="tour-preset">
          <SlidersVertical size={24} /> Preset
        </Button>
        <Button onClick={props.onImport}>
          <Import /> Import
        </Button>

        <Button onClick={props.onExport}>
          <Download /> Export
        </Button>

        <Show when={props.state.edit}>
          <Button onClick={props.onForceNew}>
            <Plus />
            New
          </Button>
        </Show>

        <Show when={!props.state.edit}>
          <Button
            schema="warning"
            onClick={() => {
              settingStore.openConfirm({
                message: 'Are you sure you wish to clear the editor?',
                onConfirm: props.onClear,
              })
            }}
          >
            <X />
          </Button>
        </Show>
      </div>
    </>
  )
}