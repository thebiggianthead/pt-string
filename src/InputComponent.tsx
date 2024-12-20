import {
  EditorEmittedEvent,
  EditorEventListener,
  EditorProvider,
  OnPasteResult,
  PasteData,
  PortableTextEditable,
  RenderDecoratorFunction,
  RenderPlaceholderFunction,
} from '@portabletext/editor'
import {htmlToBlocks, randomKey} from '@sanity/block-tools'
import {Box, Card, Flex, ThemeProvider, useToast} from '@sanity/ui'
import {type JSX, type KeyboardEvent, useCallback, useMemo, useState} from 'react'
import {
  ArrayDefinition,
  ArrayOfObjectsInputProps,
  BlockDefinition,
  ChangeIndicator,
  type PortableTextBlock,
  PortableTextChild,
  type PortableTextSpan,
  TypedObject,
  useConnectionState,
} from 'sanity'
import {useDocumentPane} from 'sanity/structure'
import styled from 'styled-components'

import {decoratorMap} from './decoratorMap'
import {ptStringType} from './schema'
import {Toolbar} from './Toolbar'
import {PtStringOptions} from './types'
import {toFormPatches} from './utils'

const EMPTY_ARRAY: [] = []

const InputWrapper = styled(Card)`
  position: relative;
  overflow: hidden;
  font-size: ${(props) => `${props.theme.sanity.fonts.text.sizes[2].fontSize}px`};
  cursor: text;

  &:focus-within {
    box-shadow: 0 0 0 1px var(--card-focus-ring-color);

    div {
      outline: none;
    }
  }

  [role='textbox'] {
    white-space: pre !important;
    overflow-x: auto;
    /* hide scrollbar */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
`

const Placeholder = styled(Card)`
  color: ${(props) => props.theme.sanity.color.input.default.enabled.placeholder};
`

const optionizedSchemaType = (schemaType: ArrayDefinition, options?: PtStringOptions) => {
  const newSchemaType = {...schemaType}

  if (options?.decorators) {
    const block = newSchemaType.of[0] as BlockDefinition
    if (!block.marks) block.marks = {}
    block.marks.decorators = options.decorators
  }
  return newSchemaType
}

export function InputComponent({
  elementProps,
  value = EMPTY_ARRAY,
  path,
  readOnly,
  changed,
  schemaType,
  onChange,
}: ArrayOfObjectsInputProps & {schemaType: {options?: PtStringOptions}}): JSX.Element {
  const toast = useToast()
  const [hasFocusWithin, setHasFocusWithin] = useState(false)
  const {editState, documentId, documentType} = useDocumentPane()
  const connectionState = useConnectionState(documentId, documentType)

  const ready = useMemo(() => {
    return connectionState === 'connected' && editState?.ready
  }, [connectionState, editState])

  const schema = optionizedSchemaType(ptStringType, schemaType.options)

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
    }
  }, [])

  /**
   * Merge blocks from pasted HTML into a single block
   */
  const handlePaste = useCallback((input: PasteData): OnPasteResult => {
    const {event, schemaTypes, path: inputPath} = input
    const html = event.clipboardData.getData('text/html')
    if (!html) return {insert: [], path: inputPath}

    const blocks = htmlToBlocks(html, schemaTypes.portableText) as PortableTextBlock[]

    const mergeToSingleBlock = (
      blocksToMerge: PortableTextBlock[],
    ): Array<PortableTextBlock | PortableTextSpan> => {
      let mergedSpans: PortableTextSpan[] = []

      blocksToMerge.forEach((block: PortableTextBlock) => {
        if (block._type === 'block' && Array.isArray(block.children)) {
          block.children.forEach((child: PortableTextChild) => {
            if (child._type === 'span') {
              mergedSpans.push({...(child as PortableTextSpan)})
            } else {
              const nestedSpans = mergeToSingleBlock([
                child as PortableTextBlock,
              ]) as PortableTextSpan[]
              mergedSpans = [...mergedSpans, ...nestedSpans]
            }
          })
        }
      })

      // Ensure spaces between spans from different blocks or sub-blocks
      for (let i = 0; i < mergedSpans.length - 1; i++) {
        if (mergedSpans[i].text.endsWith(' ')) continue
        // If the next span has marks, insert a space, otherwise merge the text
        if (mergedSpans[i]?.marks?.length) {
          mergedSpans.splice(i + 1, 0, {
            _key: randomKey(12),
            _type: 'span',
            text: ' ',
          } as PortableTextSpan)
        } else {
          mergedSpans[i].text += ' '
        }
      }

      return new Array({
        _key: randomKey(12),
        _type: 'block',
        children: mergedSpans,
        style: 'normal',
      })
    }

    return {
      insert: mergeToSingleBlock(blocks) as unknown as TypedObject[],
      path: inputPath,
    }
  }, [])

  const handleEditorChange = useCallback(
    (event: EditorEmittedEvent) => {
      switch (event.type) {
        case 'mutation':
          onChange(toFormPatches(event.patches))
          break
        case 'focused':
          setHasFocusWithin(true)
          break
        case 'blurred':
          setHasFocusWithin(true)
          break
        case 'error':
          toast.push({
            status: 'error',
            description: event.description,
          })
          break
        default:
      }
    },
    [onChange, toast],
  )

  const renderPlaceholder: RenderPlaceholderFunction = useCallback(() => {
    return <Placeholder>Empty</Placeholder>
  }, [])

  const renderDecorator: RenderDecoratorFunction = useCallback((props) => {
    const CustomDecoratorComponent = props.schemaType.component
    if (CustomDecoratorComponent) return <CustomDecoratorComponent {...props} />
    return (decoratorMap.get(props.value) ?? ((decoratorProps) => decoratorProps.children))(props)
  }, [])

  return (
    <ThemeProvider>
      <ChangeIndicator
        path={path}
        isChanged={changed}
        readOnly={!ready || readOnly}
        hasFocus={hasFocusWithin}
      >
        <EditorProvider
          initialConfig={{
            readOnly: !ready || readOnly,
            initialValue: value as PortableTextBlock[],
            schema,
          }}
        >
          <EditorEventListener on={handleEditorChange} />
          <InputWrapper
            shadow={1}
            paddingY={(schema?.of[0] as BlockDefinition)?.marks?.decorators?.length ? 1 : 2}
            paddingRight={1}
            paddingLeft={3}
            radius={2}
            tone={!ready || readOnly ? 'transparent' : 'default'}
          >
            <Flex gap={1} align="center">
              <Box flex={1} overflow={'auto'} height="fill">
                <PortableTextEditable
                  renderDecorator={renderDecorator}
                  renderPlaceholder={renderPlaceholder}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  readOnly={!ready || readOnly}
                  {...elementProps}
                />
              </Box>
              <Toolbar />
            </Flex>
          </InputWrapper>
        </EditorProvider>
      </ChangeIndicator>
    </ThemeProvider>
  )
}
