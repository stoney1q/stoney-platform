'use client';

import { createContext, useContext, ReactNode } from 'react';

type PublicStoreSettings = {
  currencyCode: string;
  currencySymbol: string;
  taxRegistration: string | null;
  receiptFooter: string | null;
};

const StoreSettingsContext = createContext<PublicStoreSettings>({
  currencyCode: 'USD',
  currencySymbol: '$',
  taxRegistration: null,
  receiptFooter: null,
});

export function StoreSettingsProvider({
  children,
  settings,
}: {
  children: ReactNode;
  settings: PublicStoreSettings;
}) {
  return (
    <StoreSettingsContext.Provider value={settings}>
      {children}
    </StoreSettingsContext.Provider>
  );
}

export function useStoreSettings() {
  return useContext(StoreSettingsContext);
}
