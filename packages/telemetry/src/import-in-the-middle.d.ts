// `register-hooks.mjs` ships a `.d.ts` that TypeScript's node16 resolution does not pair with a
// `.mjs` import; mirror the two exports used by `register.ts`.
declare module 'import-in-the-middle/register-hooks.mjs' {
  export function register(options?: {
    include?: Array<string | RegExp>;
    exclude?: Array<string | RegExp>;
    disableCjsSourceStripping?: boolean;
  }): void;
  export function supportsSyncHooks(): boolean;
}
