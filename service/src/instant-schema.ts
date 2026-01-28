import { i } from "@instantdb/admin";

/**
 * InstantDB Schema for SMS Expense Tracker
 *
 * Two tables:
 * - payments: successful transactions
 * - failedPayments: failed transaction attempts
 */
const schema = i.schema({
  entities: {
    // Successful payments
    payments: i.entity({
      transactionId: i.string().unique(),
      transactionType: i.string(),
      amount: i.number().indexed(),
      currency: i.string().indexed(),
      merchant: i.string().optional().indexed(),
      cardLastDigits: i.string().optional(),
      transactionDate: i.date().indexed(),
      messageTimestamp: i.date(),
      syncedAt: i.date(),
      plusEarned: i.number().optional(),
      plusTotal: i.number().optional(),
      bankSenderId: i.string().indexed(),
      rawMessage: i.string(),
    }),

    // Failed payment attempts
    failedPayments: i.entity({
      transactionId: i.string().unique(),
      transactionType: i.string(),
      currency: i.string().indexed(),
      merchant: i.string().optional().indexed(),
      cardLastDigits: i.string().optional(),
      failureReason: i.string().optional(),
      balance: i.number().optional(),
      transactionDate: i.date().indexed(),
      messageTimestamp: i.date(),
      syncedAt: i.date(),
      bankSenderId: i.string().indexed(),
      rawMessage: i.string(),
    }),
  },
  links: {},
});

export default schema;
export type Schema = typeof schema;
