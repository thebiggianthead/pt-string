import {definePlugin, PreviewConfig} from 'sanity'

import {ptStringType} from './schema'
import {PtStringConfig} from './types'
import {toPlainText} from './utils'

/**
 * Usage in `sanity.config.ts` (or .js)
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {ptString} from 'pt-string'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [ptString()],
 * })
 * ```
 */
export const ptString = definePlugin<PtStringConfig | void>((config) => {
  return {
    name: 'pt-string',
    schema: {types: [ptStringType(config || {})]},
  }
})

/**
 * Usage in `schemaTypes/post.ts` (or similar)
 *
 * ```ts
 * import {defineType, defineField} from 'sanity'
 * import {ptStringPreview} from 'pt-string'
 *
 * export const post = defineType({
 *   name: 'post',
 *   title: 'Post',
 *   type: 'document',
 *   fields: [
 *     defineField({
 *       name: 'title',
 *       title: 'Title',
 *       type: 'pt-string',
 *     }),
 *     // ...
 *   ],
 *   preview: ptStringPreview('title'),
 * });
 * ```
 */
export const ptStringPreview = (targetField: string): PreviewConfig => ({
  select: {
    field: targetField,
  },
  prepare(selection) {
    const title = toPlainText(selection.field)
    return {title}
  },
})
