/// <reference types="vite/client" />

declare module 'peach-math-field' {
  export * from '../../src/index'
}

declare module 'peach-math-field/styles/math-field.css' {
  const content: string
  export default content
}
