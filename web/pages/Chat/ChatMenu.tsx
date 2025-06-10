import './chat-detail.css'
import { Component } from 'solid-js'
import { ContextState } from '/web/store/context'


export const ChatMenu: Component<{
  ctx: ContextState
  isOwner: boolean
}> = (props) => {

  /*
  useSubNav({
    // title: 'Chat Options',
    header: (
      <ChatMenuTitle ctx={props.ctx} togglePane={togglePane} setModal={setModal} adapterLabel="" />
    ),
    body: (
      <ChatNav
        ctx={props.ctx}
        togglePane={togglePane}
        setModal={setModal}
        adapterLabel={adapterLabel()}
      />
    ),
  })
  */

  return null
}

