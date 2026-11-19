# Theming CitrusMail

Everything you see is themeable, from the accent color down to the 2px edge on the selected message. There are five places to change it. Use the first one that covers what you need.

| Where | What it's for | Rebuild? |
| --- | --- | --- |
| `citrusmail` in `app/app.config.ts` | Your instance's look: colors, fonts, corners, surfaces, shadows, name and logo | Yes |
| `NUXT_PUBLIC_CITRUSMAIL_THEME` | The same keys as JSON, for Docker and other hosts | No |
| `NUXT_PUBLIC_BRAND_*` | Name, logo, favicon, sign-in text and image | No |
| `brand/custom.css` | Any CSS at all, loaded after everything else | No (read on each request) |
| `ui` in `app/app.config.ts` | Per-component styling: button variants, menu padding, modal size | Yes |
| Settings → Appearance and the theme editor | Each person's own accent, font, text size, corners, greys, surfaces and light/dark | No |

Values are applied in that order, so a person's Appearance choice wins over the environment variable, which wins over `app.config.ts`. `custom.css` is loaded last and can override all of them.

## 1. The theme object

`app/app.config.ts` holds the defaults:

```ts
export default defineAppConfig({
  citrusmail: {
    name: 'Acme Mail',
    logo: '/acme.svg',            // in public/; replaces the built-in mark
    allowAppearance: true,        // false hides Settings → Appearance
    theme: {
      primary: '#7c3aed',         // any hex, or a Tailwind palette name like 'violet'
      neutral: 'zinc',            // the greys: 'stone' | 'zinc' | 'slate' | 'gray' | 'neutral'
      unread: '',                 // the unread dot; empty uses the accent
      flag: '#f59e0b',
      font: "'Inter', ui-sans-serif, system-ui, sans-serif",
      fontSize: '16px',           // the root size every rem scales from
      radius: '0.375rem',         // buttons, fields, menus, dialogs
      sheetInset: '0.5rem',       // space around the page on wide screens; '0' = edge to edge
      sheetRadius: '0.75rem',
      sheetShadow: 'none',
      floatingShadow: '0 12px 32px -16px rgb(0 0 0 / 0.3)',
      light: { /* surface colors, see below */ },
      dark: { /* the same keys for dark mode */ }
    }
  }
})
```

Every value is a plain CSS value, so `color-mix()`, `var()`, gradients and multi-layer shadows all work. Only the keys you set change; everything else keeps its default.

A hex `primary` is treated as the button color, and CitrusMail mixes the lighter and darker shades from it. A Tailwind name uses Tailwind's own scale.

### Surface colors (`light` and `dark`)

| Key | Where it shows |
| --- | --- |
| `desk` | Behind the page: the sidebar and the sign-in panel |
| `sheet` | The page you read and write on |
| `elevated` | Hover states, menus, chips |
| `accented` | Active navigation items, switch tracks |
| `border` | Lines between rows and around fields |
| `sheetBorder` | The page's edge against the desk (`transparent` for none) |
| `text`, `textHighlighted`, `textMuted` | Body text, headings, secondary text |
| `selected`, `selectedEdge` | The selected message or contact, and its left edge |
| `overlay` | The dimmed backdrop behind a dialog |

The defaults are mixed from the `neutral` palette, so changing `neutral` re-tints every surface at once.

### Fonts

CitrusMail self-hosts its fonts through `@nuxt/fonts`, so no visitor's browser contacts Google. To use a new family, add it in two places:

1. `fonts.families` in `nuxt.config.ts`
2. `citrusmail.fonts` in `app.config.ts`, which lists the choices Settings → Appearance offers

A family is only downloaded when someone uses it.

## 2. Without a rebuild

Set `NUXT_PUBLIC_CITRUSMAIL_THEME` to JSON with any of the theme keys:

```bash
NUXT_PUBLIC_CITRUSMAIL_THEME='{"primary":"#0f766e","neutral":"slate","radius":"0","sheetInset":"0","dark":{"desk":"#000"}}'
```

### Name, logo and sign-in page

`NUXT_PUBLIC_BRAND_NAME`, `_LOGO`, `_LOGO_DARK`, `_FAVICON`, `_LOGIN_TITLE`, `_LOGIN_SUBTITLE` and `_LOGIN_IMAGE` (an image URL, or `none`) override the matching keys in `citrusmail` in `app.config.ts`. The README lists what each one does.

## 3. The brand folder and custom CSS

`brand/` (or the folder in `NUXT_BRAND_DIR`) is served at `/brand/` and read on every request, so its files can change while the server runs. Keep your logo, favicon and sign-in image there and point the `NUXT_PUBLIC_BRAND_*` variables at `/brand/<file>`. Images, fonts and CSS are served; other file types are not.

`brand/custom.css` is loaded after every other stylesheet.

Every theme value is a CSS custom property, so plain `:root` and `.dark` rules override it:

```css
:root {
  --ui-radius: 0;
  --lb-sheet-inset: 0;
  --lb-selected-edge: transparent;
}
.dark {
  --lb-desk: #000;
}
```

### The tokens

| Property | Set from |
| --- | --- |
| `--ui-color-primary-50` … `950`, `--ui-primary` | `primary` |
| `--font-sans`, `--lb-font-size` | `font`, `fontSize` |
| `--ui-radius` | `radius` |
| `--lb-desk`, `--ui-bg`, `--ui-bg-elevated`, `--ui-bg-accented`, `--ui-bg-muted` | `desk`, `sheet`, `elevated`, `accented` |
| `--ui-border`, `--lb-sheet-border` | `border`, `sheetBorder` |
| `--ui-text`, `--ui-text-highlighted`, `--ui-text-muted` | the text colors |
| `--lb-sheet-inset`, `--lb-sheet-radius`, `--lb-sheet-shadow` | the sheet keys |
| `--lb-shadow`, `--lb-overlay` | `floatingShadow`, `overlay` |
| `--lb-selected`, `--lb-selected-edge`, `--lb-unread`, `--lb-flag` | row and status colors |
| `--lb-avatar-1` … `6` and `--lb-avatar-N-text` | the tints behind initials (set in `main.css`) |

### Motion

Everything that moves uses one scale, so a theme can retime the whole app from `custom.css`:

| Variable | Default | Used for |
| --- | --- | --- |
| `--lb-dur-1` | `120ms` | A press, a hover |
| `--lb-dur-2` | `180ms` | A menu, a chip, a row |
| `--lb-dur-3` | `240ms` | A panel, a pane, a page |
| `--lb-dur-4` | `320ms` | A window layout, the triage card |
| `--lb-ease-out`, `--lb-ease-in-out` | two cubic-beziers | Things arriving, things changing place |

Each person chooses how much of it they get in Settings → Appearance → Motion (System, Full, Reduced or Off), which sets `data-motion` on `<html>`; `data-density` is there too, for the Comfortable, Cozy and Compact lists.

## 4. Component styling

CitrusMail is built only from [Nuxt UI](https://ui.nuxt.com) components, and each one can be restyled from the `ui` key in `app.config.ts`. These examples make every button pill-shaped and bold, and make dialogs wider:

```ts
ui: {
  button: {
    slots: { base: 'rounded-full font-semibold' }
  },
  modal: {
    slots: { content: 'sm:max-w-2xl' }
  }
}
```

Each component's page in the Nuxt UI docs lists its slots and variants under "Theme".

## 5. Per person

Settings → Appearance lets each person pick light or dark, an accent (presets or any color), a font from `citrusmail.fonts`, a text size and corner style. A gallery of looks sets several of these at once, and the theme can follow the time of day. Set `allowAppearance: false` to give everyone the instance's look; that also hides the theme editor.

### What is kept where

| Choice | Kept |
| --- | --- |
| Accent, font, text size, corners | With the account (`appearance` in `/api/settings`), so it follows the person to other devices |
| Greys, surface colors, the sheet's inset, corners and shadow | On this computer (`citrusmail-theme-custom` in local storage) |
| An accent for each mailbox | On this computer (`citrusmail-mailbox-accents`, keyed by address) |
| Saved looks | On this computer (`citrusmail-theme-saved`) |
| Motion, density, zoom, contrast, larger text, sounds | On this computer (`citrusmail-prefs`) |

The server only accepts the four account keys, each held to a strict shape (`server/api/settings.patch.ts`), which is why the rest stays local.

### Layers

`app/plugins/theme.client.ts` merges, in this order, each layer winning over the one before:

1. `citrusmail.theme` in `app.config.ts`
2. `NUXT_PUBLIC_CITRUSMAIL_THEME`
3. The person's account choices
4. What the theme editor keeps on this computer
5. The accent of the mailbox that's open

Layers 3 to 5 come from storage the person can edit, so they are cleaned before use: only known keys are read, and a value is dropped if it is longer than 200 characters or contains `;`, `{`, `}`, `<`, `\`, `/*`, `url(`, `@import` or `expression(`.

### The theme editor

Settings → Appearance → **Customise…** (`/settings/theme`) edits every key of the theme with a live preview: a miniature of the app in light and dark side by side, drawn with the theme's own tokens (`themeVars()` in `app/utils/theme.ts` scopes a theme to one element). Each text color is measured against the surfaces it sits on, and any pair below WCAG's 4.5:1 is flagged (`contrastRatio()` in `app/utils/contrast.ts`).

- **Copy as JSON** gives exactly the object to paste into `citrusmail.theme` in `app.config.ts` or into `NUXT_PUBLIC_CITRUSMAIL_THEME`, so a look tried in the app can become the instance's default.
- **Import JSON** takes the same shape back. Every key must be one of the theme's keys and every value must pass the rules above; if anything fails, nothing is applied and each problem is named.
- **Save as preset** adds the current look to the gallery, on this computer.

### Presets

The gallery (`app/utils/theme-presets.ts`) has light looks, looks drawn for the dark (choosing one switches to dark mode) and two high-contrast looks. A preset's accent, font and corners are account choices; its `extras` (greys and surfaces) go into the local layer. `test/theme-editor.test.ts` checks every preset's text against its surfaces: 4.5:1 at least, 7:1 for the high-contrast ones.

### Accessibility

Settings → Accessibility gathers the choices that make the app easier to use:

- **Increase contrast** sets `data-contrast="high"` on `<html>`. `app/assets/css/settings.css` then raises `--ui-text-muted` and `--ui-text-dimmed` to the 700 shade (300 in dark), borders to 500 (`--ui-border-accented` and `--lb-sheet-border` to 600, 400 in dark) and makes the focus ring 3px. Muted text then measures between 8.18:1 and 10.46:1 in light and between 9.87:1 and 12.08:1 in dark for every `neutral` (see `test/contrast.test.ts`). The same applies when the computer asks for more contrast (`prefers-contrast: more`) and the setting is left at normal. A theme can restyle it from `custom.css` with `html[data-contrast='high']` rules.
- **Larger text and controls** sets `data-text="large"`: the root size goes one step (an eighth) above the chosen text size and Nuxt UI buttons get a 32px minimum hit area.
- **Motion** and **Sounds for what you do** are the same controls as in Appearance and Notifications.

The accent eases from one color to the next when it changes: `--ui-primary` is registered with `@property` and transitions on `<html>` for `--lb-dur-4` (not when Motion is Off).
