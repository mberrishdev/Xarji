// Override-aware categoriser. Looks up the merchant's manual override
// first; falls back to the regex-based default. Both `categorize` (id)
// and `getCategory` (full record) are returned so call sites can keep
// the same shape they had with the static helpers in lib/utils.ts.
//
// Use this anywhere a single transaction needs a category, in place of
// the static `getCategory(merchant, raw)` / `categorizeId(...)` from
// lib/utils.ts. The static helpers stay around for code paths that
// need a synchronous answer without React state (e.g. data seeders).

import { useCallback, useMemo } from "react";
import {
  DEFAULT_CATEGORIES,
  categorizeId,
  getCategory as defaultGetCategory,
  type InkCategory,
} from "../lib/utils";
import { useMerchantOverrides } from "./useMerchantOverrides";
import { useCategories } from "./useCategories";

export interface Categorizer {
  /** Returns the category id (e.g. "groceries") for a merchant. */
  categorize: (merchant: string | null | undefined, raw?: string | null) => string;
  /** Returns the full InkCategory record with name + color + icon. */
  getCategory: (merchant: string | null | undefined, raw?: string | null) => InkCategory;
  /** Convenience for places that historically called `autoCategorize`
   *  to get the human-facing category name (e.g. "Groceries"). */
  categorizeName: (merchant: string | null | undefined) => string;
  /** Merged list of DEFAULT_CATEGORIES + DB-backed categories (DB wins
   *  on id collision so a renamed default uses the user's name).
   *  Use this anywhere you'd previously have hardcoded `DEFAULT_CATEGORIES`
   *  — pickers, dropdowns, lookup-by-id calls — so user-created
   *  categories show up consistently. */
  allCategories: InkCategory[];
}

export function useCategorizer(): Categorizer {
  const { byMerchant } = useMerchantOverrides();
  const { categories: dbCategories } = useCategories();

  // DB categories override defaults on id collision so a user-renamed
  // "Groceries" → "Food shop" propagates everywhere. New custom
  // categories (those with ids not in DEFAULT_CATEGORIES) get appended.
  // Order: defaults first (predictable for the regex categoriser's
  // fallback), then any custom categories the user created.
  const allCategories = useMemo<InkCategory[]>(() => {
    const byId = new Map<string, InkCategory>();
    for (const c of DEFAULT_CATEGORIES) byId.set(c.id, c);
    for (const c of dbCategories) {
      byId.set(c.id, { id: c.id, name: c.name, color: c.color, icon: c.icon });
    }
    return Array.from(byId.values());
  }, [dbCategories]);

  const getCategory = useCallback(
    (merchant: string | null | undefined, raw?: string | null): InkCategory => {
      if (merchant) {
        const override = byMerchant.get(merchant.trim().toLowerCase());
        if (override) {
          const hit = allCategories.find((c) => c.id === override.categoryId);
          if (hit) return hit;
          // Override points at a category that no longer exists (deleted
          // or never created). Fall through to the regex categoriser
          // rather than returning a broken record. The dangling override
          // should be cleaned up by the delete-category code path; we
          // don't want this hot path silently fixing data.
        }
      }
      // Resolve the regex result against the merged category list so a
      // renamed default (e.g. "Subscriptions" → "Recurring") propagates.
      // Falls back to defaultGetCategory if the merged lookup fails so
      // we never return undefined.
      const id = categorizeId(merchant, raw);
      return allCategories.find((c) => c.id === id) ?? defaultGetCategory(merchant, raw);
    },
    [byMerchant, allCategories]
  );

  const categorize = useCallback(
    (merchant: string | null | undefined, raw?: string | null): string => {
      if (merchant) {
        const override = byMerchant.get(merchant.trim().toLowerCase());
        // Only honour an override if the target still exists. Dangling
        // overrides re-route to the regex result.
        if (override && allCategories.some((c) => c.id === override.categoryId)) {
          return override.categoryId;
        }
      }
      return categorizeId(merchant, raw);
    },
    [byMerchant, allCategories]
  );

  const categorizeName = useCallback(
    (merchant: string | null | undefined): string => getCategory(merchant).name,
    [getCategory]
  );

  return useMemo(
    () => ({ categorize, getCategory, categorizeName, allCategories }),
    [categorize, getCategory, categorizeName, allCategories]
  );
}
