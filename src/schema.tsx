import {defineType, SchemaTypeDefinition} from 'sanity'

import {InputComponent, type PtStringInputProps} from './InputComponent'
import type {PtStringConfig} from './types'
/**
 * @public
 */
export const ptStringTypeName = 'pt-string' as const

/**
 * @public
 */
export const ptStringType = (config: PtStringConfig): SchemaTypeDefinition => {
  const {annotations, inlineBlocks} = config

  return defineType({
    type: 'array',
    name: ptStringTypeName,
    components: {
      input: (props: PtStringInputProps) =>
        InputComponent({
          ...props,
          defaultAnnotations: config?.annotations,
          defaultInlineBlocks: config?.inlineBlocks,
        }),
    },
    of: [
      // @ts-expect-error we want to define "of" here even though it's not allowed on the "ptStringTypeName" schema type in Studios
      {
        type: 'block',
        styles: [{title: 'Normal', value: 'normal'}],
        of: inlineBlocks || [],
        lists: [],
        marks: {
          decorators: [
            {title: 'Strong', value: 'strong'},
            {title: 'Emphasis', value: 'em'},
            {title: 'Code', value: 'code'},
            {title: 'Underline', value: 'underline'},
            {title: 'Strike', value: 'strike-through'},
          ],
          annotations: annotations || [],
        },
      },
    ],
  })
}
