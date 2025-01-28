import {htmlToBlocks} from '@portabletext/block-tools'
import {
  EditorEmittedEvent,
  EditorEventListener,
  EditorProvider,
  PortableTextEditable,
  RenderAnnotationFunction,
  RenderDecoratorFunction,
  RenderPlaceholderFunction,
} from '@portabletext/editor'
import {coreBehaviors, defineBehavior} from '@portabletext/editor/behaviors'
import {Box, Card, Flex, ThemeProvider, useToast} from '@sanity/ui'
import {type JSX, type KeyboardEvent, useCallback, useMemo, useState} from 'react'
import {
  type ArrayDefinition,
  type ArrayOfObjectsInputProps,
  type ArrayOfType,
  type BlockAnnotationDefinition,
  type BlockDefinition,
  ChangeIndicator,
  isPortableTextTextBlock,
  type Path,
  type PortableTextBlock,
  type PortableTextChild,
  type PortableTextObject,
  type PortableTextSpan,
  useConnectionState,
} from 'sanity'
import {useDocumentPane} from 'sanity/structure'
import styled from 'styled-components'

import {Annotation, AnnotationForm} from './Annotation'
import {annotationMap, decoratorMap} from './defaultPreviews'
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

const Placeholder = styled('div')`
  color: ${(props) => props.theme.sanity.color.input.default.enabled.placeholder};
`

export type PtStringInputProps = ArrayOfObjectsInputProps & {
  schemaType: {options?: PtStringOptions}
  defaultAnnotations?: BlockAnnotationDefinition[]
  defaultInlineBlocks?: ArrayOfType<'object' | 'reference', undefined>[]
}

export function InputComponent(props: PtStringInputProps): JSX.Element {
  const {
    elementProps,
    value = EMPTY_ARRAY,
    path,
    readOnly,
    changed,
    schemaType,
    onChange,
    defaultAnnotations,
    defaultInlineBlocks,
  } = props
  const toast = useToast()
  const [hasFocusWithin, setHasFocusWithin] = useState(false)
  const {editState, documentId, documentType} = useDocumentPane()
  const connectionState = useConnectionState(documentId, documentType)

  const ready = useMemo(() => {
    return connectionState === 'connected' && editState?.ready
  }, [connectionState, editState])

  // Get the original schema type with default decorators and annotations
  const originalSchemaType = ptStringType({
    annotations: defaultAnnotations,
    inlineBlocks: defaultInlineBlocks,
  })

  // Merge the original schema type with the custom options
  const schema = useMemo(() => {
    const newSchemaType = {...originalSchemaType} as ArrayDefinition

    const block = newSchemaType.of[0] as BlockDefinition
    if (!block.marks) block.marks = {}

    if (schemaType?.options?.decorators) {
      block.marks.decorators = schemaType?.options.decorators
    }

    if (Array.isArray(schemaType?.options?.disableAnnotations)) {
      block.marks.annotations = block?.marks?.annotations?.filter(
        (annotation) =>
          !annotation.name ||
          !(schemaType?.options?.disableAnnotations as string[]).includes(annotation.name),
      )
    } else if (schemaType?.options?.disableAnnotations) {
      block.marks.annotations = []
    }

    return newSchemaType
  }, [originalSchemaType, schemaType])

  // Prevent the default behavior of inserting a new block when pressing Enter
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
    }
  }, [])

  const pasteBehaviour = defineBehavior({
    on: 'paste',
    guard: ({context, event}) => {
      const ptText = event.data.getData('application/x-portable-text')
      const html = event.data.getData('text/html')

      // it's plain text, not portable text or htmls so just paste as is
      if (!ptText && !html) return false

      const blocks = ptText
        ? JSON.parse(ptText)
        : (htmlToBlocks(html, context.schema.portableText) as PortableTextBlock[])

      const mergeToSingleBlock = (
        blocksToMerge: PortableTextBlock[],
      ): {
        children: (PortableTextSpan | PortableTextObject)[]
        markDefs: PortableTextObject[]
      } => {
        let mergedSpans: (PortableTextSpan | PortableTextObject)[] = []
        const mergedMarkDefs: PortableTextObject[] = []

        blocksToMerge.forEach((block: PortableTextBlock, blockIndex: number) => {
          if (block._type === 'block' && Array.isArray(block.children)) {
            const childCount = block.children.length
            block.children.forEach((child: PortableTextChild, childIndex: number) => {
              if (child._type === 'span') {
                const isLastChild = childIndex === childCount - 1
                const isLastBlock = blockIndex === blocksToMerge.length - 1
                if (isLastChild && !isLastBlock && !(child?.text as string)?.endsWith(' ')) {
                  child.text += ' '
                }

                mergedSpans.push({...(child as PortableTextSpan)})
              } else if (context.schema.inlineObjects.find((io) => io.name === child._type)) {
                mergedSpans.push(child as PortableTextObject)
              } else {
                const nestedSpans = mergeToSingleBlock([child as PortableTextBlock])
                  .children as PortableTextSpan[]
                mergedSpans = [...mergedSpans, ...nestedSpans]
              }
            })

            if (isPortableTextTextBlock(block)) {
              block?.markDefs?.forEach((markDef) => {
                mergedMarkDefs.push(markDef)
              })
            }
          }
        })

        return {
          children: mergedSpans,
          markDefs: mergedMarkDefs,
        }
      }

      return mergeToSingleBlock(blocks)
    },
    actions: [
      (_, {children, markDefs}) => {
        const isSpan = (child: PortableTextChild): child is PortableTextSpan => {
          return child._type === 'span'
        }

        return children.map((child) => {
          if (isSpan(child)) {
            const decorators = child.marks
              ?.filter((mark) => !markDefs.find((def) => def._key === mark))
              .filter((decorator) => decorator !== null)

            const annotations = child.marks
              ?.map((mark) => {
                const foundAnnotation = markDefs.find((def) => def._key === mark)
                if (foundAnnotation) {
                  const {_type, ...rest} = foundAnnotation
                  return {name: _type, value: rest}
                }
                return null
              })
              .filter((annotation) => annotation !== null)

            return {
              type: 'insert.span',
              text: child.text,
              decorators,
              annotations,
            }
          }

          return {
            type: 'insert.inline object',
            inlineObject: {
              name: child._type,
              child,
            },
          }
        })
      },
    ],
  })

  // When the editor emits an event, update the form value
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

  // Render a placeholder when the editor is empty
  const renderPlaceholder: RenderPlaceholderFunction = useCallback(() => {
    return <Placeholder>Empty</Placeholder>
  }, [])

  // Render custom decorators or use the default ones
  const renderDecorator: RenderDecoratorFunction = useCallback((decoratorProps) => {
    const CustomDecoratorComponent = decoratorProps.schemaType.component
    if (CustomDecoratorComponent) return <CustomDecoratorComponent {...decoratorProps} />
    return (decoratorMap.get(decoratorProps.value) ?? ((dProps) => dProps.children))(decoratorProps)
  }, [])

  // Set a state for the annotation that should be editable
  const [editableAnnotation, setEditableAnnotation] = useState<Path | null>(null)

  // Render custom annotations or use the default ones
  const renderAnnotation: RenderAnnotationFunction = useCallback((annotationProps) => {
    const CustomAnnotationComponent = annotationProps.schemaType.components?.preview
    const DefaultAnnotationComponent = (
      (annotationMap.get(annotationProps.schemaType.name) || annotationMap.get('default')) ??
      ((aProps) => aProps.children)
    )(annotationProps)

    return (
      <Annotation
        annotationPath={annotationProps?.path}
        setEditableAnnotation={setEditableAnnotation}
        {...annotationProps}
      >
        {CustomAnnotationComponent ? (
          <CustomAnnotationComponent {...annotationProps} />
        ) : (
          DefaultAnnotationComponent
        )}
      </Annotation>
    )
  }, [])

  const buttonCount =
    ((schema?.of[0] as BlockDefinition)?.marks?.decorators?.length || 0) +
    ((schema?.of[0] as BlockDefinition)?.marks?.annotations?.length || 0)

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
            behaviors: [...coreBehaviors, pasteBehaviour],
          }}
        >
          {editableAnnotation && (
            <AnnotationForm
              {...props}
              annotationPath={editableAnnotation}
              setEditableAnnotation={setEditableAnnotation}
            />
          )}
          <EditorEventListener on={handleEditorChange} />
          <InputWrapper
            shadow={1}
            paddingY={buttonCount ? 1 : 2}
            paddingRight={1}
            paddingLeft={3}
            radius={2}
            tone={!ready || readOnly ? 'transparent' : 'default'}
          >
            <Flex gap={1} align="center">
              <Box flex={1} overflow={'auto'} height="fill">
                <PortableTextEditable
                  renderDecorator={renderDecorator}
                  renderAnnotation={renderAnnotation}
                  renderPlaceholder={renderPlaceholder}
                  onKeyDown={handleKeyDown}
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
