import {type Editor, useEditor, useEditorSelector} from '@portabletext/editor'
import * as selectors from '@portabletext/editor/selectors'
import {
  BoldIcon,
  CodeIcon,
  EllipsisVerticalIcon as MenuIcon,
  type IconComponent,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@sanity/icons'
import {
  Button,
  Flex,
  Menu,
  MenuButton,
  MenuItem,
  Text,
  Tooltip,
  TooltipDelayGroupProvider,
  useMediaIndex,
} from '@sanity/ui'
import {type JSX, useCallback, useId, useMemo} from 'react'
import type {BlockDecoratorDefinition} from 'sanity'

const iconMap: Record<string, IconComponent> = {
  strong: BoldIcon,
  em: ItalicIcon,
  code: CodeIcon,
  underline: UnderlineIcon,
  'strike-through': StrikethroughIcon,
}

const MOBILE_DECORATOR_LIMIT = 2
const DESKTOP_DECORATOR_LIMIT = 2

export function Toolbar(): JSX.Element {
  const editor = useEditor()
  const currentSchema = editor.getSnapshot().context.schema
  const mediaIndex = useMediaIndex()
  const menuId = useId()

  const isMobile = mediaIndex < 2
  const decorators = currentSchema.decorators
  const decoratorLimit = isMobile ? MOBILE_DECORATOR_LIMIT : DESKTOP_DECORATOR_LIMIT

  const mainDecorators = useMemo(() => {
    return decorators.slice(0, decoratorLimit)
  }, [decorators, decoratorLimit])
  const overflowDecorators = useMemo(() => {
    return decorators.slice(decoratorLimit)
  }, [decorators, decoratorLimit])
  const showMenuButton = decorators.length > decoratorLimit

  return (
    <Flex gap={1} wrap="wrap">
      <TooltipDelayGroupProvider delay={{open: 400}}>
        {mainDecorators.map((decorator) => (
          <DecoratorInsert decorator={decorator} editor={editor} key={decorator.value} />
        ))}
      </TooltipDelayGroupProvider>

      {showMenuButton && (
        <MenuButton
          id={menuId}
          button={<Button mode="bleed" padding={2} icon={MenuIcon} />}
          menu={
            <Menu>
              {overflowDecorators.map((decorator) => (
                <DecoratorInsert
                  decorator={decorator}
                  editor={editor}
                  key={decorator.value}
                  isMenu
                />
              ))}
            </Menu>
          }
        />
      )}
    </Flex>
  )
}

function DecoratorInsert(props: {
  decorator: BlockDecoratorDefinition
  editor: Editor
  isMenu?: boolean
}) {
  const {decorator, editor, isMenu} = props

  const active = useEditorSelector(editor, selectors.isActiveDecorator(decorator.value))
  const Icon = props.decorator.icon ? props.decorator.icon : iconMap[props.decorator.value]

  const handleDecoratorClick = useCallback(() => {
    editor.send({
      type: 'decorator.toggle',
      decorator: decorator.value,
    })
    editor.send({
      type: 'focus',
    })
  }, [decorator.value, editor])

  if (isMenu) {
    return (
      <MenuItem
        text={decorator.title}
        icon={iconMap[decorator.value]}
        onClick={handleDecoratorClick}
        tone={active ? 'neutral' : 'default'}
        pressed={active}
      />
    )
  }

  return (
    <Tooltip animate content={<Text size={1}>{decorator.title}</Text>} placement="top" portal>
      <Button
        mode="bleed"
        padding={2}
        selected={active}
        key={decorator.value}
        text={Icon ? undefined : decorator.title}
        icon={Icon}
        onClick={handleDecoratorClick}
      />
    </Tooltip>
  )
}
