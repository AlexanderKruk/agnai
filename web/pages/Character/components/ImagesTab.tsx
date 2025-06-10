import { Component } from 'solid-js'
import { Image } from 'lucide-solid'

export const ImagesTab: Component = () => {
  return (
    <div class={`flex items-center gap-2 text-center`}>
      Image Settings have moved: Click the <Image size={16} />
      in the main menu
    </div>
  )
}