import { Component } from 'solid-js'
import { Dices } from 'lucide-solid'
import Button from '../../../shared/Button'
import TextInput, { ButtonInput } from '../../../shared/TextInput'
import { FormLabel } from '../../../shared/FormLabel'
import { Card } from '../../../shared/Card'
import TagInput from '../../../shared/TagInput'
import PersonaAttributes from '../../../shared/PersonaAttributes'
import Select from '../../../shared/Select'
import { random } from '../../../shared/util'
import { AvatarField } from '../form/AvatarField'
import { Regenerate } from '../form/Regenerate'
import { AlternateGreetingsInput } from '../form/AltGreetings'
import { AppSchema } from '../../../../common/types/schema'

const formatOptions = [
  { value: 'attributes', label: 'Attributes (Key: value)' },
  { value: 'text', label: 'Plain Text' },
]

export interface PersonaTabProps {
  editor: any // CharEditor type
  user: any // UserState type  
  tagState: any // TagState type
  tokens: any
  setTokens: (fn: (prev: any) => any) => void
  updateFile: (files: any) => void
  showBuilder: () => boolean
  setShowBuilder: (show: boolean) => void
  image: () => string | undefined
  setImageUrl: (url: string) => void
  forceNew: () => boolean
  spriteRef: any
}

export const PersonaTab: Component<PersonaTabProps> = (props) => {

  return (
    <div class="flex flex-col gap-2">
      <Card class="tour-prefields">
        <ButtonInput
          fieldName="name"
          required
          label="Character Name"
          placeholder=""
          value={props.editor.state.name}
          parentClass="pb-2"
          onChange={(ev) => props.editor.update('name', ev.currentTarget.value)}
        >
          <Button
            size="sm"
            schema="input"
            onClick={() => random('first', {}).then((name) => props.editor.update('name', name))}
          >
            <Dices size={12} />
          </Button>
        </ButtonInput>

        <FormLabel
          label="Description / Creator's notes"
          helperText={
            <div class="flex flex-col">
              <span>
                A description, label, or notes for your character. This is will not
                influence your character in any way.
              </span>
            </div>
          }
        />

        <div class="flex w-full flex-col gap-2">
          <TextInput
            isMultiline
            fieldName="description"
            parentClass="w-full"
            value={props.editor.state.description}
            onChange={(ev) => props.editor.update('description', ev.currentTarget.value)}
          />
        </div>
      </Card>

      <Card>
        <TagInput
          availableTags={props.tagState.tags.map((t: any) => t.tag)}
          value={props.editor.state.tags}
          fieldName="_tags"
          label="Tags"
          helperText="Used to help you organize and filter your characters."
          onSelect={(tags) => props.editor.update({ tags })}
        />
      </Card>

      <AvatarField
        user={props.user}
        editor={props.editor}
        updateFile={props.updateFile}
        showBuilder={props.setShowBuilder}
        image={props.image}
        setImageUrl={(url: string | undefined) => props.setImageUrl(url || '')}
        forceNew={props.forceNew}
        spriteRef={props.spriteRef}
      />

      <Card>
        <TextInput
          fieldName="scenario"
          label={
            <>
              <Regenerate
                field={'scenario'}
                editor={props.editor}
                allowed={props.editor.canGuidance}
                class="tour-gen-field"
              />
              Scenario{' '}
            </>
          }
          helperText="The current circumstances and context of the conversation and the characters."
          placeholder="E.g. {{char}} is in their office working. {{user}} opens the door and walks in."
          value={props.editor.state.scenario}
          onChange={(ev) => props.editor.update('scenario', ev.currentTarget.value)}
          isMultiline
          tokenCount={(v) => props.setTokens((prev: any) => ({ ...prev, scenario: v }))}
        />
      </Card>

      <Card class="flex flex-col gap-3">
        <div>
          <FormLabel
            label={
              <div class="flex items-center gap-1">
                {props.editor.state.personaKind === 'text' && (
                  <Regenerate
                    field={'persona'}
                    editor={props.editor}
                    allowed={props.editor.canGuidance}
                    class="tour-gen-field"
                  />
                )}
                Personality
              </div>
            }
            helperText="A description of the personality of your character."
          />

          <div class="flex flex-col gap-2">
            <Select
              fieldName="personaKind"
              items={formatOptions}
              value={props.editor.state.personaKind}
              onChange={(option) => props.editor.update('personaKind', option.value)}
            />

            {props.editor.state.personaKind === 'text' ? (
              <TextInput
                isMultiline
                fieldName="persona"
                value={props.editor.state.persona.text}
                placeholder="Describe your character's personality..."
                onChange={(ev) =>
                  props.editor.update('persona', { text: ev.currentTarget.value })
                }
                tokenCount={(v) => props.setTokens((prev: any) => ({ ...prev, persona: v }))}
              />
            ) : (
              <PersonaAttributes
                state={props.editor.state.persona.attributes}
                setter={(attributes: any) => props.editor.update('persona', { attributes })}
                tokenCount={(v) => props.setTokens((prev: any) => ({ ...prev, persona: v }))}
              />
            )}
          </div>
        </div>
      </Card>

      <Card>
        <TextInput
          fieldName="greeting"
          label={
            <>
              <Regenerate
                field={'greeting'}
                editor={props.editor}
                allowed={props.editor.canGuidance}
                class="tour-gen-field"
              />
              Greeting
            </>
          }
          helperText="The first message from your character. It is recommended to provide a lengthy first message to encourage the character to give longer responses."
          placeholder={
            props.editor.state.personaKind === 'text'
              ? `E.g. *I smile as you approach me* Oh, hello there! I can't believe it's really you. *I laugh nervously* I'm so excited to see you. I've been waiting for this for so long.`
              : `*I smile as you approach me* Oh, hello there! I can't believe it's really you. *I laugh nervously* I'm so excited to see you. I've been waiting for this for so long.`
          }
          value={props.editor.state.greeting}
          onChange={(ev) => props.editor.update('greeting', ev.currentTarget.value)}
          isMultiline
          class="min-h-[8rem]"
          tokenCount={(v) => props.setTokens((prev: any) => ({ ...prev, greeting: v }))}
        />

        <AlternateGreetingsInput
          greetings={props.editor.state.alternateGreetings}
          setGreetings={(greetings: AppSchema.Character['alternateGreetings']) =>
            props.editor.update('alternateGreetings', greetings)
          }
        />
      </Card>

      <Card>
        <TextInput
          fieldName="sampleChat"
          label="Sample Conversation"
          helperText={
            <span>
              Example chat between you and the character. This section is very important for
              character responses. The sample conversation will be inserted into the prompt
              when conversing with your character.
              <br />
              <br />
              <b>Format:</b> The conversation should be written in this format:
              <br />
              <br />
              <span class="family-mono whitespace-pre-wrap bg-[var(--bg-700)] px-2 py-1">
                {`{{user}}: Hello there!\n{{char}}: *smiles and waves back* Oh, hello! I'm so happy to see you!`}
              </span>
            </span>
          }
          placeholder="{{user}}: Hi {{char}}, how are you today?\n{{char}}: *I smile brightly* I'm doing great! Thanks for asking!"
          value={props.editor.state.sampleChat}
          onChange={(ev) => props.editor.update('sampleChat', ev.currentTarget.value)}
          isMultiline
          tokenCount={(v) => props.setTokens((prev: any) => ({ ...prev, sampleChat: v }))}
        />
      </Card>
    </div>
  )
}