"use client";
import { useEffect, useRef, useState } from "react";
import { accountRepository, ACCOUNT_KEY, createDefaultProfile, defaultAccount } from "./account-repository";
import type { Activity, ClosedPos, Pos, Profile } from "./types";

/** Owns browser persistence and hydration; UI and market prices stay outside it. */
export function useStoredAccount(notify: (message: string) => void) {
  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; }, [notify]);
  const [defaults] = useState(() => defaultAccount(createDefaultProfile()));
  const [hydrated, setHydrated] = useState(false);
  const [balance, setBalance] = useState(defaults.balance);
  const [favorites, setFavorites] = useState(defaults.favorites);
  const [recent, setRecent] = useState(defaults.recent);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [history, setHistory] = useState<ClosedPos[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<Profile>(defaults.profile);
  const [claimAt, setClaimAt] = useState(0);
  const [selectedPair, setSelectedPair] = useState(defaults.selectedPair);

  useEffect(() => {
    function hydrate() {
      try {
        const saved = accountRepository.load(defaults.profile);
        setBalance(saved.balance);
        setFavorites(saved.favorites);
        setRecent(saved.recent);
        setPositions(saved.positions);
        setHistory(saved.history);
        setActivity(saved.activity);
        setProfile(saved.profile);
        setClaimAt(saved.claimAt);
        setSelectedPair(saved.selectedPair);
      } catch {
        notifyRef.current("Saved browser data was invalid, so safe defaults were restored");
      }
      setHydrated(true);
    }
    hydrate();
    function onStorage(event: StorageEvent) {
      if (event.key === ACCOUNT_KEY || event.key === null) hydrate();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [defaults]);

  useEffect(() => {
    if (!hydrated) return;
    if (!accountRepository.save({ version: 5, balance, favorites, recent, positions, history, activity, profile, claimAt, selectedPair })) {
      notifyRef.current("Browser storage is full or unavailable. Recent changes may not persist after refresh.");
    }
  }, [hydrated, balance, favorites, recent, positions, history, activity, profile, claimAt, selectedPair]);

  return { hydrated, balance, setBalance, favorites, setFavorites, recent, setRecent,
    positions, setPositions, history, setHistory, activity, setActivity,
    profile, setProfile, claimAt, setClaimAt, selectedPair, setSelectedPair };
}
