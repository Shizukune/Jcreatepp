# Upstream license sources

These are original license texts used when a distributed npm package does not include its own license file, or when VitePress embeds a font. Do not substitute Jcreate++'s license for a third-party license.

- `blockly-12.5.1.txt`: https://github.com/RaspberryPiFoundation/blockly/blob/blockly-v12.5.1/LICENSE — Blockly 12.5.1's npm package declares Apache-2.0 but omits the license file. Attribution is retained in the bundle and generated notices.
- `Inter-OFL.txt`: https://github.com/rsms/inter/blob/master/LICENSE.txt — Inter font distributed by VitePress 1.6.4; original copyright and SIL OFL 1.1 text.
- `docsearch-3.8.2.txt`: https://github.com/algolia/docsearch/blob/v3.8.2/LICENSE — MIT text omitted from the installed `@docsearch/css` 3.8.2 package.
- `Lucide-ISC.txt`: https://github.com/lucide-icons/lucide/blob/0.468.0/LICENSE — original ISC text including the Feather copyright for icons embedded in VitePress 1.6.4's theme CSS. Its CSS identifies Lucide as the source but does not expose a separate npm module for these SVGs.

`scripts/license-notices.js` reads other license and NOTICE files from the installed versions actually included in the Web and guide builds. A bundled package with no license text fails the build instead of silently disappearing from the notices. When upgrading dependencies, review their license files and the generated output.

Unity's managed libraries have separate notices in `unity/Jcreatepp/Editor/Preview/Plugins/THIRD-PARTY-NOTICES.md`.
