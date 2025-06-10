import { Component, Show } from 'solid-js'
import { RootModal } from '../../../shared/Modal'
import { ModeGenSettings } from '../../../shared/Mode/ModeGenSettings'
import { SpriteModal } from '../form/SpriteModal'
import { AvatarModal } from '../form/AvatarModal'
import { DownloadModal } from '../DownloadModal'
import ImportCharacterModal from '../ImportCharacter'
import { AppSchema } from '../../../../common/types/schema'

export interface FormModalsProps {
  editor: any // CharEditor type
  openPreset: () => boolean
  setOpenPreset: (open: boolean) => void
  presetFooter: () => any
  setPresetFooter: (footer: any) => void
  showBuilder: () => boolean
  setShowBuilder: (show: boolean) => void
  converted: () => AppSchema.Character | undefined
  setConverted: (char: AppSchema.Character | undefined) => void
  showImport: () => boolean
  setImport: (show: boolean) => void
  showAvatar: () => boolean
  setShowAvatar: (show: boolean) => void
  image: () => string | undefined
  setImage: (image: string | undefined) => void
}

export const FormModals: Component<FormModalsProps> = (props) => {
  return (
    <>
      <RootModal
        show={props.openPreset()}
        close={() => props.setOpenPreset(false)}
        title="Generation Preset"
        footer={props.presetFooter()}
        maxWidth="half"
      >
        <ModeGenSettings
          presetId={props.editor.state.preset}
          onPresetChanged={(presetId: string) => props.editor.update('preset', presetId)}
          close={() => props.setOpenPreset(false)}
          footer={props.setPresetFooter}
        />
      </RootModal>

      <Show when={props.showBuilder()}>
        <SpriteModal
          body={props.editor.state.sprite}
          onChange={(body) => {
            props.editor.update('sprite', body)
            props.setShowBuilder(false)
          }}
          show={props.showBuilder()}
          close={() => props.setShowBuilder(false)}
        />
      </Show>

      <Show when={props.converted()}>
        <DownloadModal
          show
          close={() => props.setConverted(undefined)}
          char={props.converted()!}
          charId={props.converted()!._id}
        />
      </Show>

      <ImportCharacterModal
        show={props.showImport()}
        close={() => props.setImport(false)}
        onSave={async (char, imgs) => {
          await props.editor.load(char[0])
          props.editor.receiveAvatar(imgs[0]!)
          props.setImport(false)
        }}
      />

      <Show when={props.showAvatar()}>
        <AvatarModal
          url={props.image()}
          close={() => props.setShowAvatar(false)}
        />
      </Show>
    </>
  )
}