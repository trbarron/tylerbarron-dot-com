declare module '@fal-works/esbuild-plugin-global-externals' {
  export type ModuleInfo = any;
  const content: any;
  export default content;
}

declare module '@mdx-js/esbuild/lib' {
  export type Options = any;
  const content: any;
  export default content;
}

// Injected at build time by vite.config.ts `define`.
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
