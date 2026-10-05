"use client";

import { useEffect } from "react";
import { clearFlashAction } from "@/app/flash-actions";
import { Alert } from "@/components/ui";
import type { Flash } from "@/lib/flash";

export function FlashBanner({ flash }: { flash: Flash }) {
  useEffect(() => {
    void clearFlashAction();
  }, []);
  return <Alert tone={flash.tone} message={flash.message} />;
}
