# Harbor brand (Canopy)

Harbor is matthewmaynes.com's Canopy brand. It re-points Canopy's `primary` role onto an
ocean-steel blue (`harbor`) and the neutrals onto a cool blue-gray (`slate`), and inherits the
rest (accent, secondary, status) from Canopy's defaults.

These are the source DTCG token files, consumed by the `@rogueoak/roots` brand pipeline:

- `primitive.json` - the `harbor` + `slate` ramps (plus `base.white`).
- `semantic.json` / `semantic.dark.json` - the Canopy semantic roles Harbor overrides, light and
  dark. Only overridden roles are listed; every role omitted here inherits Canopy's default by
  cascade.
- `brand.config.json` - wires the above into `roots-brand`.

## Regenerate

```bash
npm run theme:build
```

That runs `roots-brand brand/harbor/brand.config.json`, which compiles these sources into
`src/styles/brand-harbor.generated.css` (a `:root` + `.dark` block, imported after
`@rogueoak/roots/tokens.css` in `src/styles/globals.css`). Commit the regenerated CSS. Do not
hand-edit the generated file.

The pipeline enforces **WCAG AA in both themes**, including for the roles Harbor inherits: each
override is checked against the Canopy default it lands next to, so the build fails if a
combination is illegible. (This is what flagged the original dark primary - a mid-tone blue that
failed AA against any foreground - now a lighter step that passes.)

The generated CSS and the `brand/harbor/*.json` sources are inputs to the resume-PDF freshness
hash (`scripts/generate-resume-pdf.mjs`), so changing the palette makes `npm run resume:pdf:check`
require a regenerated `public/resume.pdf`.
