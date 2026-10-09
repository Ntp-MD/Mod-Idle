// Vite's `?inline` query hands a stylesheet back as text. The wiki wears the client's own `app.css`
// that way, so the palette stays in the one file that owns it.
declare module '*.css?inline' {
  const css: string;
  export default css;
}
