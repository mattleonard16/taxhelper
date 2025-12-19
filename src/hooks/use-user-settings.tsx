"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { UserSettings } from "@/types";

interface UserSettingsContextValue {
  settings: UserSettings | null;
  loading: boolean;
  currency: string;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  name: null,
  email: null,
  country: null,
  state: null,
  defaultTaxRate: null,
  currency: "USD",
  timezone: "America/Los_Angeles",
};

const UserSettingsContext = createContext<UserSettingsContextValue>({
  settings: null,
  loading: true,
  currency: "USD",
  refreshSettings: async () => {},
});

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (status !== "authenticated") {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        setSettings(defaultSettings);
      }
    } catch {
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === "loading") return;
    fetchSettings();
  }, [status, fetchSettings]);

  const currency = settings?.currency || "USD";

  return (
    <UserSettingsContext.Provider
      value={{
        settings,
        loading,
        currency,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  return useContext(UserSettingsContext);
}

export function useCurrency() {
  const { currency } = useUserSettings();
  return currency;
}
