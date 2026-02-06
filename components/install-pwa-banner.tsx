"use client";

import { useEffect, useRef, useState } from "react";

type InstallMode = "prompt" | "ios";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "pwa-install-dismissed-until";
const DISMISS_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isIosSafari() {
  if (typeof window === "undefined") {
    return false;
  }

  const ua = window.navigator.userAgent;
  const isIosDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);

  return isIosDevice && isSafari;
}

function isMobileDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(max-width: 768px)").matches ||
    ("ontouchstart" in window && window.matchMedia("(pointer: coarse)").matches)
  );
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isDismissed() {
  if (typeof window === "undefined") {
    return false;
  }

  const dismissedUntil = window.localStorage.getItem(DISMISS_KEY);
  if (!dismissedUntil) {
    return false;
  }

  return Number(dismissedUntil) > Date.now();
}

function setDismissedUntil() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS_MS));
}

export function InstallPwaBanner() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isMobileDevice() || isStandaloneDisplay() || isDismissed()) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      setMode("prompt");
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (isIosSafari()) {
      setMode("ios");
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setDismissedUntil();
    setIsVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt.current) {
      handleDismiss();
      return;
    }

    await deferredPrompt.current.prompt();
    await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setIsVisible(false);
  };

  if (!isVisible || !mode) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex w-full justify-center px-4 pb-4 md:hidden">
      <div className="w-full max-w-md rounded-2xl border border-base-800 bg-base-900/95 p-4 text-text-base shadow-lg backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">App installieren</div>
            {mode === "prompt" ? (
              <p className="mt-1 text-xs text-text-muted">
                Installiere BD CRM für schnellen Zugriff.
              </p>
            ) : (
              <p className="mt-1 text-xs text-text-muted">
                Installieren: Teilen → Zum Home-Bildschirm
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Schließen"
            onClick={handleDismiss}
            className="text-text-muted transition hover:text-text-base"
          >
            ✕
          </button>
        </div>
        {mode === "prompt" ? (
          <button
            type="button"
            onClick={handleInstall}
            className="mt-3 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-base-950 transition hover:bg-emerald-400"
          >
            App installieren
          </button>
        ) : null}
      </div>
    </div>
  );
}
