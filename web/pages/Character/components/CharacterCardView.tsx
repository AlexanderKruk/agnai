import { Component, For, Match, Show, Switch, createSignal } from 'solid-js'
import { CardProps, ViewProps } from './types'
import Divider from '/web/shared/Divider'
import { A, useNavigate } from '@solidjs/router'
import AvatarContainer from '/web/shared/Avatar/Container'
import { getAssetUrl, toDuration } from '/web/shared/util'
import {
  ArrowRight,
  Copy,
  Download,
  Menu,
  MessageCirclePlus,
  Pencil,
  Star,
  Trash,
  VenetianMask,
} from 'lucide-solid'
import { DropMenu } from '/web/shared/DropMenu'
import Button from '/web/shared/Button'
import { chatStore, type NewChat } from '../../../store'

export const CharacterCardView: Component<ViewProps> = (props) => {
  return (
    <For each={props.groups}>
      {(group, i) => (
        <>
          <Show when={props.showGrouping}>
            <h2 class="text-xl font-bold">{group.label}</h2>
          </Show>
          <div class="grid w-full grid-cols-[repeat(auto-fit,minmax(160px,1fr))] flex-row flex-wrap justify-start gap-2 py-2">
            <For each={group.list}>
              {(char) => (
                <Character
                  edit={() => props.setEdit(char)}
                  char={char}
                  delete={() => props.setDelete(char)}
                  download={() => props.setDownload(char)}
                  toggleFavorite={(value) => props.toggleFavorite(char._id, value)}
                />
              )}
            </For>
            <Show when={group.list.length < 4}>
              <For each={new Array(4 - group.list.length)}>{() => <div></div>}</For>
            </Show>
          </div>
          <Show when={i() < props.groups.length - 1}>
            <Divider />
          </Show>
        </>
      )}
    </For>
  )
}

const Character: Component<CardProps> = (props) => {
  const [opts, setOpts] = createSignal(false)
  const nav = useNavigate()

  let ref: any

  const size = 20

  const handleCreateChatAndNavigate = async () => {
    if (opts()) return

    try {
      const newChatProps: NewChat = { name: props.char.name, useOverrides: false }
      chatStore.createChat(props.char._id, newChatProps, (newChatId: string) => {
        nav(`/chat/${newChatId}`)
      })
    } catch (error) {
      console.error('Failed to create chat:', error)
    }
  }

  return (
    <div
      ref={ref}
      class="bg-800 flex cursor-pointer flex-col items-center justify-between gap-1 rounded-lg border-[1px] border-[var(--bg-700)] hover:border-[var(--hl-500)]"
      onClick={handleCreateChatAndNavigate}
    >
      <div class="w-full pointer-events-none">
        <div class="block h-32 w-full justify-center overflow-hidden rounded-lg rounded-b-none">
          <Switch>
            <Match when={props.char.visualType === 'sprite' && props.char.sprite}>
              <AvatarContainer container={ref} body={props.char.sprite} />
            </Match>
            <Match when={props.char.avatar}>
              <img
                src={getAssetUrl(props.char.avatar!)}
                class="h-full w-full object-cover"
                style="object-position: 50% 30%;"
                alt={`${props.char.name} avatar`}
              />
            </Match>
            <Match when>
              <div class="bg-700 flex h-32 w-full items-center justify-center rounded-lg rounded-b-none">
                <VenetianMask size={24} />
              </div>
            </Match>
          </Switch>
        </div>
      </div>
      <div class="w-full text-sm">
        <div class="pointer-events-none overflow-hidden text-ellipsis whitespace-nowrap px-1 text-center font-bold">
          {props.char.name}
        </div>
        <div class="pointer-events-none text-600 line-clamp-3 h-[3rem] text-ellipsis px-1 text-center text-xs font-normal">
          {props.char.description}
        </div>
        <div class="flex justify-between p-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              props.toggleFavorite(!props.char.favorite)
            }}
            aria-label="Toggle Favorite"
            class="z-10"
          >
            <Show when={props.char.favorite}>
              <Star size={size} class="text-900 fill-[var(--text-900)]" />
            </Show>
            <Show when={!props.char.favorite}>
              <Star size={size} />
            </Show>
          </button>

          <div class="pointer-events-none text-500 text-xs italic">
            {props.char.chat ? toDuration(new Date(props.char.chat.updatedAt)) + ' ago' : ''}
          </div>
        </div>
        <div class="float-left ml-[3px] mt-[-224px]">
          <div
            class="z-10 cursor-pointer rounded-md border-[1px] border-[var(--bg-400)] bg-[var(--bg-700)] p-[2px]"
            onClick={(e) => { 
              e.stopPropagation(); 
              props.download(); 
            }}
            aria-label="Download Character"
          >
            <Download size={size} />
          </div>
        </div>
        <div
          class="float-right mr-[3px] mt-[-224px] flex justify-end"
          onClick={(e) => { 
            e.stopPropagation(); 
            setOpts(true); 
          }}
        >
          <div class="z-10 cursor-pointer rounded-md border-[1px] border-[var(--bg-400)] bg-[var(--bg-700)] p-[2px]">
            <Menu size={size} class="icon-button" color="var(--bg-100)" />
          </div>
          <DropMenu
            show={opts()}
            close={() => setOpts(false)}
            customPosition="right-[9px] top-[6px]"
          >
            <div class="flex flex-col gap-2 p-2">
              <Button onClick={(e) => { e.stopPropagation(); props.edit(); setOpts(false); }} aria-label="Edit" alignLeft size="sm">
                <Pencil size={size} /> Edit
              </Button>
              <Button
                alignLeft
                onClick={(e) => { e.stopPropagation(); nav(`/character/create/${props.char._id}`); setOpts(false); }}
                size="sm"
              >
                <Copy /> Duplicate
              </Button>
              <Button
                alignLeft
                size="sm"
                schema="red"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpts(false)
                  props.delete()
                }}
              >
                <Trash /> Delete
              </Button>
            </div>
          </DropMenu>
        </div>
      </div>
    </div>
  )
}
