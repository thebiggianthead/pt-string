import type {ArrayDefinition, BlockAnnotationDefinition, BlockDecoratorDefinition} from 'sanity'

import {ptStringTypeName} from './schema'

/**
 * @public
 */
export interface PtStringConfig {
  annotations?: BlockAnnotationDefinition[]
}

/**
 * @public
 */
export interface PtStringOptions {
  decorators?: BlockDecoratorDefinition[]
  disableAnnotations?: boolean | string[]
}

/**
 * @public
 */
export type PtStringDefinition = Omit<ArrayDefinition, 'type' | 'of' | 'options'> & {
  type: typeof ptStringTypeName
  options?: PtStringOptions
}

// redeclares sanity module so we can add interfaces props to it
declare module 'sanity' {
  // redeclares IntrinsicDefinitions and adds a named definition to it
  // it is important that the key is the same as the type in the definition ('magically-added-type')
  export interface IntrinsicDefinitions {
    [ptStringTypeName]: PtStringDefinition
  }
}
