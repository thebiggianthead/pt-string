// @ts-nocheck

import {useEditor, useEditorSelector} from '@portabletext/editor'
import * as selectors from '@portabletext/editor/selectors'
import {EditIcon, TrashIcon} from '@sanity/icons'
import {
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  Flex,
  Inline,
  Popover,
  Portal,
  Stack,
  Text,
} from '@sanity/ui'
import {type JSX, type ReactElement, useCallback, useEffect, useMemo, useState} from 'react'
import {
  FormField,
  FormInput,
  MemberField,
  type ObjectInputProps,
  type Path,
  pathToString,
  type RenderInputCallback,
} from 'sanity'

export function Annotation({
  annotationPath,
  children,
}: {
  annotationPath: Path
  children: ReactElement
}): JSX.Element {
  const editor = useEditor()
  const selectedSpan = useEditorSelector(editor, selectors.getFocusSpan)
  const selectedBlock = useEditorSelector(editor, selectors.getFocusBlock)
  const spanType = selectedBlock?.node.markDefs?.find(
    (markDef) => markDef._key === selectedSpan?.node.marks[0],
  )?._type
  const annotationSchema =
    spanType &&
    editor
      .getSnapshot()
      .context.schema.annotations.find((annotation) => annotation.name === spanType)

  const [open, setOpen] = useState(false)
  const [cursorRect, setCursorRect] = useState<DOMRect | null>(null)

  const cursorElement = useMemo(() => {
    if (!cursorRect) {
      return null
    }
    return {
      getBoundingClientRect: () => {
        return cursorRect
      },
    }
  }, [cursorRect]) as HTMLElement

  useEffect(() => {
    if (selectedSpan?.path && pathToString(annotationPath) === pathToString(selectedSpan?.path)) {
      setOpen(true)
      const sel = window.getSelection()

      if (!sel || sel.rangeCount === 0) return

      const range = sel.getRangeAt(0)
      const rect = range?.getBoundingClientRect()
      if (rect) {
        setCursorRect(rect)
      }
    } else {
      setOpen(false)
    }
  }, [annotationPath, selectedSpan])

  editor.on('blurred', () => {
    setTimeout(() => {
      setOpen(false)
    }, 100)
  })

  const handleRemoveButtonClicked = useCallback(() => {
    console.log('remove it', annotationSchema?.name)
    editor.send({
      type: 'annotation.remove',
      annotation: {
        name: annotationSchema?.name,
      },
    })
    editor.send({type: 'focus'})
  }, [annotationSchema?.name, editor])

  return (
    <Popover
      content={
        <Box padding={1} data-testid="annotation-toolbar-popover">
          <Flex gap={1}>
            <Box padding={2}>
              <Text weight="medium" size={1}>
                {annotationSchema?.title || 'Edit Annotation'}
              </Text>
            </Box>
            <Button
              aria-label={'Edit Annotation'}
              data-testid="edit-annotation-button"
              icon={EditIcon}
              mode="bleed"
              // onClick={handleEditButtonClicked}
              tabIndex={0}
              padding={2}
            />
            <Button
              aria-label={'Remove Annotation'}
              data-testid="remove-annotation-button"
              icon={TrashIcon}
              mode="bleed"
              onClick={handleRemoveButtonClicked}
              tabIndex={0}
              tone="critical"
              padding={2}
            />
          </Flex>
        </Box>
      }
      constrainSize
      placement="top"
      portal
      preventOverflow
      open={open}
      referenceElement={cursorElement}
      scheme="dark"
    >
      {children}
    </Popover>
  )
}

export function AnnotationForm(props: ObjectInputProps & {annotationPath: Path}): JSX.Element {
  const path = [...props.path, ...props.annotationPath]

  props.members[0].item.schemaType.options = props.annotationSchema

  return (
    // <Portal>
    //   <Dialog header="Example" id="dialog-example" zOffset={1000}>
    <Stack space={2}>
      <Card padding={3} radius={2}>
        <Stack space={4}>
          <Card shadow={2} padding={3} radius={2}>
            <FormInput {...props} absolutePath={path} />
          </Card>
        </Stack>
      </Card>
    </Stack>
    //   </Dialog>
    // </Portal>
  )
}
