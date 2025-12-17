"use client";

import * as React from "react";

export type RequiredFieldResolver = (path: string) => boolean;

const RequiredFieldContext = React.createContext<RequiredFieldResolver | null>(
  null
);

export function RequiredFieldProvider({
  isRequired,
  children,
}: {
  isRequired: RequiredFieldResolver;
  children: React.ReactNode;
}) {
  return (
    <RequiredFieldContext.Provider value={isRequired}>
      {children}
    </RequiredFieldContext.Provider>
  );
}

export function useRequiredField(path?: string): boolean | undefined {
  const resolver = React.useContext(RequiredFieldContext);
  if (!resolver || !path) return undefined;
  try {
    return resolver(String(path));
  } catch {
    return undefined;
  }
}


