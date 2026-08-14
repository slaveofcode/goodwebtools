declare module 'csso' {
  export function minify(source: string, options?: Record<string, unknown>): { css: string };
}
