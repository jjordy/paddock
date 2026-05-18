declare module 'virtual:jsx-wc/routes' {
  export const version: number
  export const routes: ReadonlyArray<{
    pattern: string
    load: () => Promise<any>
    layouts: ReadonlyArray<() => Promise<any>>
  }>
  export const notFound: (() => Promise<any>) | null
  export const errorPage: (() => Promise<any>) | null
}

declare global {
  interface Window {
    __JSX_WC_DATA__?: {
      data: unknown
      params: Record<string, string>
      url: string
      form: {
        name: string
        values?: Record<string, unknown>
        errors?: Record<string, string>
        formError?: string | null
      } | null
    }
  }
}

export {}
