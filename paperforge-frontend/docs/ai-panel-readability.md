# AI panel readability

All four optional AI reports share a scoped typography/layout layer in `src/styles/ai-panels.css`. Individual feature styles retain their own cards and visual identity. No AI contracts, requests, calculations, storage, timing or trading behavior changed.

- Explanations: one rem (normally sixteen pixels), comfortable line height.
- Labels, evidence and secondary text: twelve to thirteen pixels, using rem units.
- Important financial values: approximately seventeen pixels with tabular numerals and wrapping.
- Section headings: eighteen pixels; panel titles: twenty-four pixels.
- Buttons: at least fourteen-pixel text; close controls and principal actions have forty-four-pixel targets.
- Disabled controls retain readable labels; evidence captions and footers use stronger muted colors.

Cards use adaptive columns rather than reducing font sizes. Long symbols, unavailable metrics and large negative amounts wrap. Report headers/footers remain reachable while bodies scroll. Narrow tablet risk panels receive sufficient reading width. Landscape/short viewport rules retain a usable scroll body. Styles are scoped to AI reports and their entry actions.

## Verification

`node scripts/verify-ai-readability.mjs` uses isolated Chrome with offline style fixtures, not Gemini. It checks all four reports with dense text, long labels, large negative amounts, unavailable values, loading/errors/outdated content and disabled controls. It measures rendered fonts, panel bounds, horizontal overflow, close targets and text contrast using WCAG relative luminance with ancestor alpha compositing. For gradients it checks every color stop and uses the worst result.

Thirty-two panel/layout combinations cover widths 320, 390, 768, 1024 and 1440, landscape, a 720 by 450 CSS viewport at double device scale (equivalent to the layout space of a 1440 by 900 window at 200% zoom), and doubled root text sizing. The equivalent zoom case verifies reflow, not Chrome's browser-toolbar zoom setting. Minimum measured fixture text contrast was 6.19:1. Eight screenshots are saved as `paperforge-readable-{review,risk,debrief,radar}-{desktop,mobile}.png` in the system temporary directory.

The actual risk-check, Arena Debrief and Arena Radar browser harnesses also passed using mocked APIs, including mobile bounds, focus/Escape, retries, changed input, late responses, navigation, sign-out and settlement. Completed-trade review styling is covered by the dense rendered fixture and existing frontend regression tests. A screen-reader audit and manual toolbar zoom on physical devices have not been performed.

Run frontend `npm run lint`, `npm run typecheck`, and `npm test` for code checks, the production build and regression tests. No live Gemini requests are necessary or used for this UI change.
