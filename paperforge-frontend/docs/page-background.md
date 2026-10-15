# Page background styling

The app wrapper now paints a static charcoal/navy background with a faint technical grid and soft mint/teal lighting near the outer edges. Two gentle fades keep the central content and lower sections quieter. Mobile uses a wider, fainter grid. Forced-colour and print modes omit the decoration.

Runtime changes are limited to `src/styles/page-background.css` and its import in `src/app/layout.tsx`. No elements, stacking contexts, pointer targets, animation, dependencies or JavaScript effects were added. The wrapper's existing transparent children reveal the paint naturally; no card, chart, dialog or navigation surfaces were changed. The login screen does not render this wrapper and retains its original styling.

## Before and after

These screenshots use synthetic market data and a local development account fixture. The before images disable only the new wrapper background on the same production build; all existing styles and data are identical. The after images enable the new CSS.

| View | Before | After |
| --- | --- | --- |
| Desktop, 1440 x 1000 | [Before](backgrounds/home-desktop-before.png) | [After](backgrounds/home-desktop-after.png) |
| Mobile, 390 x 844 | [Before](backgrounds/home-mobile-before.png) | [After](backgrounds/home-mobile-after.png) |

## Verification

Lint, TypeScript and production build checks passed. `node --experimental-strip-types scripts/verify-background-ui.mjs` passed:

- Home, Trade, Portfolio, Markets, competition hub, Leaderboards and Profile at desktop, 390px, 320px and 200% equivalent zoom.
- Active and finished competition layouts at desktop and mobile.
- Exact before/after element geometry, existing card/chart/button surface styles, and no document overflow. Existing CSS animations are paused only during measurements to avoid comparing different animation frames.
- Long-page scrolling and sticky navigation.
- Market-dialog hit testing and Escape dismissal.
- Identical share-card PNG data before and after enabling the background.
- Forced-colour fallback, no AI requests and no browser console errors in the background check.

The existing browser regression scripts additionally check all four AI panels, including keyboard access, mobile layouts, cancellation and errors. They use intercepted fixtures rather than Gemini. Background verification does not require backend, login, credentials or deployment changes.
