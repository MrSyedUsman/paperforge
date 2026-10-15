"use client";
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Market, Quote } from '../../lib/market-data/markets';
import type { Lobby } from './types';
import type { PriceHistory } from './bot-types';
import { sampleMarkets, restorePriceHistory } from './bot-history';
import { allowedBotMarkets, runBotRound } from './bot-scheduler';
/** The UI supplies its timestamp; collection and decisions never run during React render. */
export function useCompetitionBots(lobby: Lobby | null, setLobby: Dispatch<SetStateAction<Lobby | null>>, markets: Market[], quotes: Record<string, Quote>, feed: string, now: number) {
  const history = useRef<PriceHistory>({});
  const restored = useRef<number | null>(null);
  useEffect(() => {
    if (lobby && restored.current !== lobby.start) {
      const saved = restorePriceHistory(lobby.botHistory);
      for (const [pair, rows] of Object.entries(saved)) if ((rows.at(-1)?.at || 0) > (history.current[pair]?.at(-1)?.at || 0)) history.current = { ...history.current, [pair]: rows };
      restored.current = lobby.start;
    }
    history.current = sampleMarkets(history.current, allowedBotMarkets(markets, lobby?.settings), quotes, now, feed === 'live');
    if (!lobby || lobby.status !== 'active') return;
    const observed = history.current;
    setLobby(current => current ? runBotRound(current, observed, markets, quotes, now, feed === 'live') : current);
  }, [lobby, setLobby, markets, quotes, feed, now]);
}
