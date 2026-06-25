"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function MSWProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(process.env.NEXT_PUBLIC_USE_MOCK !== "true");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCK !== "true") return;

    let active = true;
    const fallbackId = window.setTimeout(() => {
      if (active) setReady(true);
    }, 30000);

    void import("@/lib/mock/browser")
      .then(({ worker }) => worker.start({ onUnhandledRequest: "bypass" }))
      .catch((error) => {
        console.error("[MSW] Failed to start mock worker", error);
      })
      .finally(() => {
        window.clearTimeout(fallbackId);
        if (active) setReady(true);
      });

    return () => {
      active = false;
      window.clearTimeout(fallbackId);
    };
  }, []);

  if (!ready) {
    return (
      <div className="app-loading" aria-label="載入中">
        <span className="spinner" />
      </div>
    );
  }

  return <>{children}</>;
}
