import { init, i } from "@instantdb/react";

// Define the schema
const schema = i.schema({
  entities: {
    payments: i.entity({
      transactionId: i.string().unique(),
      transactionType: i.string(),
      amount: i.number().indexed(),
      currency: i.string().indexed(),
      merchant: i.string().optional().indexed(),
      cardLastDigits: i.string().optional(),
      transactionDate: i.number().indexed(),
      messageTimestamp: i.number(),
      syncedAt: i.number(),
      plusEarned: i.number().optional(),
      plusTotal: i.number().optional(),
      bankSenderId: i.string().indexed(),
      rawMessage: i.string(),
    }),
    failedPayments: i.entity({
      transactionId: i.string().unique(),
      transactionType: i.string(),
      currency: i.string().indexed(),
      merchant: i.string().optional().indexed(),
      cardLastDigits: i.string().optional(),
      failureReason: i.string().optional(),
      balance: i.number().optional(),
      transactionDate: i.number().indexed(),
      messageTimestamp: i.number(),
      syncedAt: i.number(),
      bankSenderId: i.string().indexed(),
      rawMessage: i.string(),
    }),
    categories: i.entity({
      name: i.string(),
      color: i.string(),
      icon: i.string(),
      isDefault: i.boolean(),
    }),
    bankSenders: i.entity({
      senderId: i.string().unique(),
      displayName: i.string(),
      enabled: i.boolean(),
      createdAt: i.number(),
    }),
    credits: i.entity({
      transactionId: i.string().unique(),
      transactionType: i.string(),
      amount: i.number().indexed(),
      currency: i.string().indexed(),
      counterparty: i.string().optional().indexed(),
      cardLastDigits: i.string().optional(),
      transactionDate: i.number().indexed(),
      messageTimestamp: i.number(),
      syncedAt: i.number(),
      bankSenderId: i.string().indexed(),
      rawMessage: i.string(),
    }),
  },
  links: {},
});

// Resolve the InstantDB app id at page-load time, not at bundle time.
// The service injects `window.__XARJI_APP_ID__` into the served
// index.html with whatever is currently in ~/.xarji/config.json — so
// a fresh onboarding that writes a new app id just requires a reload,
// not a rebuild of the client bundle.
//
// Fallback order:
//   1. window.__XARJI_APP_ID__  (runtime-injected by the service)
//   2. VITE_INSTANT_APP_ID       (build-time env for dev-mode `bun run dev`)
//   3. Hard-coded sentinel       (will produce an obvious failure if
//                                 neither of the above is populated)
declare global {
  interface Window {
    __XARJI_APP_ID__?: string;
  }
}

function resolveAppId(): string {
  if (typeof window !== "undefined" && window.__XARJI_APP_ID__) {
    return window.__XARJI_APP_ID__;
  }
  return import.meta.env.VITE_INSTANT_APP_ID || "f78a0d50-1945-431a-91ea-96f68570d4a5";
}

const APP_ID = resolveAppId();

export const db = init({ appId: APP_ID, schema });

// Export types for use in components (using undefined for optional fields to match InstantDB)
export type Payment = {
  id: string;
  transactionId: string;
  transactionType: string;
  amount: number;
  currency: string;
  merchant?: string;
  cardLastDigits?: string;
  transactionDate: number;
  messageTimestamp: number;
  syncedAt: number;
  plusEarned?: number;
  plusTotal?: number;
  bankSenderId: string;
  rawMessage: string;
};

export type FailedPayment = {
  id: string;
  transactionId: string;
  transactionType: string;
  currency: string;
  merchant?: string;
  cardLastDigits?: string;
  failureReason?: string;
  balance?: number;
  transactionDate: number;
  messageTimestamp: number;
  syncedAt: number;
  bankSenderId: string;
  rawMessage: string;
};

export type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
};

export type BankSender = {
  id: string;
  senderId: string;
  displayName: string;
  enabled: boolean;
  createdAt: number;
};

export type Credit = {
  id: string;
  transactionId: string;
  transactionType: string;
  amount: number;
  currency: string;
  counterparty?: string;
  cardLastDigits?: string;
  transactionDate: number;
  messageTimestamp: number;
  syncedAt: number;
  bankSenderId: string;
  rawMessage: string;
};
