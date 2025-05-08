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
          <div class="grid w-full grid-cols-[repeat(auto-fit,minmax(320px,1fr))] flex-row flex-wrap justify-start gap-2 py-2">
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

  let imageAreaRef: HTMLDivElement | undefined

  const size = 18

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
      class="bg-800 flex flex-row rounded-lg border-[1px] border-[var(--bg-700)] hover:border-[var(--hl-500)] cursor-pointer aspect-[16/9] overflow-hidden"
      onClick={handleCreateChatAndNavigate}
    >
      <div ref={imageAreaRef} class="relative w-1/3 h-full flex-shrink-0">
        <div class="absolute inset-0 pointer-events-none">
          <Switch>
            <Match when={props.char.visualType === 'sprite' && props.char.sprite}>
              <AvatarContainer container={imageAreaRef!} body={props.char.sprite} />
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
              <div class="bg-700 flex h-full w-full items-center justify-center">
                <VenetianMask size={32} />
              </div>
            </Match>
          </Switch>
        </div>

        <div
          class="absolute top-1.5 left-1.5 z-10 cursor-pointer rounded-md border-[1px] border-[var(--bg-400)] bg-[var(--bg-700)] p-1"
          onClick={(e) => {
            e.stopPropagation();
            props.toggleFavorite(!props.char.favorite);
          }}
          aria-label="Toggle Favorite"
        >
          <Show when={props.char.favorite}>
            <Star size={size} class="text-900 fill-[var(--text-900)]" />
          </Show>
          <Show when={!props.char.favorite}>
            <Star size={size} />
          </Show>
        </div>

        <div class="absolute top-1.5 right-1.5 z-10">
          <div
            class="relative cursor-pointer rounded-md border-[1px] border-[var(--bg-400)] bg-[var(--bg-700)] p-1"
            onClick={(e) => {
              e.stopPropagation();
              setOpts(true);
            }}
          >
            <Menu size={size} class="icon-button" color="var(--bg-100)" />
            <DropMenu
              show={opts()}
              close={() => setOpts(false)}
              customPosition="right-0 top-full mt-1"
            >
              <div class="flex flex-col gap-1 p-1.5">
                <Button onClick={(e) => { e.stopPropagation(); props.edit(); setOpts(false); }} aria-label="Edit" alignLeft size="sm">
                  <Pencil size={size - 2} /> Edit
                </Button>
                <Button
                  alignLeft
                  onClick={(e) => { e.stopPropagation(); nav(`/character/create/${props.char._id}`); setOpts(false); }}
                  size="sm"
                >
                  <Copy size={size - 2} /> Duplicate
                </Button>
                <Button
                  alignLeft
                  size="sm"
                  schema="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpts(false);
                    props.delete();
                  }}
                >
                  <Trash size={size - 2} /> Delete
                </Button>
              </div>
            </DropMenu>
          </div>
        </div>
      </div>

      <div class="w-2/3 h-full flex flex-col justify-between p-2 text-sm overflow-hidden">
        <div class="flex-shrink-0 overflow-hidden text-ellipsis whitespace-nowrap pb-1 font-bold text-base leading-tight">
          {props.char.name}
        </div>

        <div class="flex-grow overflow-hidden text-600 text-xs font-normal leading-snug">
          <p class="h-full w-full" style="display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;">
            {props.char.description}
          </p>
        </div>

        <div class="flex-shrink-0 pt-1 text-500 text-xs italic" style="min-height: 1.5em;">
          <Show when={props.char.chat?.updatedAt}>
            {toDuration(new Date(props.char.chat!.updatedAt)) + ' ago'}
          </Show>
        </div>
      </div>
    </div>
  )
}
