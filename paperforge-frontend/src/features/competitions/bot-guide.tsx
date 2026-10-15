"use client";
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { BOT_GUIDE } from './bot-guide-catalogue';
type Props = { open: boolean; dismiss: () => void; trigger: RefObject<HTMLButtonElement | null>; participants?: string[]; finished: boolean };
export function BotGuide({ open, dismiss, trigger, participants, finished }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current, target = trigger.current, originalOverflow = document.body.style.overflow;
    // Native modal dialogs provide top-layer rendering, background inertness and keyboard focus containment.
    if (!element.open) element.showModal();
    document.body.style.overflow = 'hidden';
    title.current?.focus({ preventScroll: true });
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = originalOverflow;
      if (target?.isConnected && !target.disabled) target.focus({ preventScroll: true });
      else {
        const fallback = document.querySelector<HTMLElement>('main h1, main h2, main');
        if (fallback) { const hadTabIndex = fallback.hasAttribute('tabindex'); if (!hadTabIndex) fallback.tabIndex = -1; fallback.focus({ preventScroll: true }); if (!hadTabIndex) fallback.addEventListener('blur', () => fallback.removeAttribute('tabindex'), { once: true }); }
      }
    };
  }, [open, trigger]);
  const present = participants ? new Set(participants) : null;
  // The portal is mounted only after hydration (the guide can only be opened by a click).
  if (!open) return null;
  return createPortal(<dialog ref={dialog} className="bot-guide-dialog" aria-labelledby="bot-guide-title" aria-describedby="bot-guide-intro" onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const first = buttons[0], last = buttons.at(-1), active = document.activeElement;
    if (event.shiftKey && (active === first || !buttons.includes(active as HTMLButtonElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (active === last || !buttons.includes(active as HTMLButtonElement))) { event.preventDefault(); first?.focus(); }
  }} onCancel={event => { event.preventDefault(); dismiss(); }} onClose={event => { if (!event.currentTarget.open) dismiss(); }}>
    <div className="bot-guide-heading"><div><span className="bot-guide-eyebrow">KNOW YOUR OPPONENTS</span><h2 id="bot-guide-title" ref={title} tabIndex={-1}>Meet the bots</h2><p id="bot-guide-intro">Seven distinct styles. Learn what each opponent waits for.</p></div><button type="button" className="bot-guide-close" onClick={dismiss} aria-label="Close bot guide">&times;</button></div>
    <div className="bot-guide-body">
      <div className="bot-guide-context"><span className="bot-guide-count">{present ? `${BOT_GUIDE.filter(bot => present.has(bot.name)).length} of 7 bots in this arena` : '7 distinct trading styles'}</span><p>Rule-based simulated opponents using observed market data. Difficulty and lobby settings affect their behaviour.</p></div>
      {finished && present && <p className="bot-guide-finished" role="status">Your arena has finished. Close this guide to view the results.</p>}
      <table className="bot-guide-table" role="table"><caption className="sr-only">Compare all seven competition bots. Risk approaches are relative to other bots and are not assurances of safety.</caption><thead><tr><th scope="col">Bot</th><th scope="col">Speciality</th><th scope="col">Looks for</th><th scope="col">Usually exits when</th><th scope="col">Risk approach</th></tr></thead><tbody>{BOT_GUIDE.map(bot => {
        const participating = present?.has(bot.name);
        return <tr key={bot.name} className={present ? participating ? 'bot-guide-present' : 'bot-guide-absent' : ''} style={{ '--bot-accent': bot.accent } as CSSProperties}><th scope="row"><div className="bot-guide-identity"><span className="bot-guide-avatar" aria-hidden="true">{bot.avatar}</span><span><b>{bot.name}</b><small>{bot.style}</small></span></div>{present && <span className="bot-guide-presence">{participating ? 'In this arena' : 'Not in this arena'}</span>}</th><td><span className="bot-guide-mobile-label" aria-hidden="true">Speciality</span>{bot.speciality}</td><td><span className="bot-guide-mobile-label" aria-hidden="true">Looks for</span>{bot.looksFor}</td><td><span className="bot-guide-mobile-label" aria-hidden="true">Usually exits when</span>{bot.exits}</td><td><span className="bot-guide-mobile-label" aria-hidden="true">Risk approach</span>{bot.risk}</td></tr>;
      })}</tbody></table>
      <div className="bot-guide-notes"><p><b>Same eligibility rules.</b> Bots need at least one opened trade and cumulative margin equal to half the starting allocation. They may finish ineligible when suitable opportunities, time or balance are insufficient.</p><p><b>Risk is relative.</b> These descriptions compare bots, not safety or likely profits. Signals use sampled prices, not candle patterns. These bots do not use machine learning or Gemini reasoning.</p></div>
    </div><div className="bot-guide-bottom"><span>The clock, prices and bot decisions continue while you read.</span><button type="button" onClick={dismiss}>Got it</button></div>
  </dialog>, document.body);
}
