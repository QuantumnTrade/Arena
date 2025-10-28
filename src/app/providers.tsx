"use client";
import React from 'react';
import { SWRConfig } from 'swr';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      focusThrottleInterval: 5000,
      dedupingInterval: 5000,
      errorRetryCount: 2,
      errorRetryInterval: 8000,
      shouldRetryOnError: true,
    }}>
      {children}
    </SWRConfig>
  );
}
