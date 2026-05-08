/**
 * Supplier category group definitions.
 * Groups are stored in the DB (type = 'supplier-group') and each supplier
 * sub-category has a `parent_group` column linking it to a group's value.
 *
 * This module provides:
 *  - A hardcoded fallback for when the DB is unavailable or groups haven't been seeded yet.
 *  - A `buildDynamicGroups()` helper that constructs groups from fetched CategoryRow data.
 */

import type { CategoryRow } from "@/types/database";

export interface CategoryGroup {
  key: string;
  labelEn: string;
  labelJa: string;
  /** Ordered list of sub-category values belonging to this group */
  children: string[];
}

/** Hardcoded fallback — used when DB data is unavailable */
export const FALLBACK_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    key: "food-supplies",
    labelEn: "Food & Supplies",
    labelJa: "食材・供給品",
    children: ["meat-poultry", "seafood", "produce-dry-goods", "beverages"],
  },
  {
    key: "kitchen-hardware",
    labelEn: "Kitchen & Hardware",
    labelJa: "厨房・設備",
    children: ["kitchen-equipment", "furniture-interior"],
  },
  {
    key: "tech-pos",
    labelEn: "Tech & POS",
    labelJa: "テクノロジー",
    children: ["pos-systems", "crm", "inventory", "online-ordering"],
  },
  {
    key: "professional-services",
    labelEn: "Professional Services",
    labelJa: "専門サービス",
    children: ["services-maintenance", "consultancy-marketing"],
  },
];

/**
 * Build category groups dynamically from DB rows.
 * @param groupRows  - rows with type = 'supplier-group'
 * @param supplierRows - rows with type = 'supplier' (each has parent_group)
 * @returns ordered CategoryGroup[] — falls back to FALLBACK_CATEGORY_GROUPS when no group rows exist
 */
export function buildDynamicGroups(
  groupRows: CategoryRow[],
  supplierRows: CategoryRow[]
): CategoryGroup[] {
  if (!groupRows || groupRows.length === 0) {
    return FALLBACK_CATEGORY_GROUPS;
  }

  const sorted = [...groupRows].sort((a, b) => a.sort_order - b.sort_order);

  return sorted.map((g) => {
    const children = supplierRows
      .filter((c) => (c.parent_group || "") === g.value)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => c.value);

    return {
      key: g.value,
      labelEn: g.label,
      labelJa: g.label_ja || g.label,
      children,
    };
  });
}

/** Map from old category value → new category value (for backward compatibility) */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  meat: "meat-poultry",
  vegetables: "produce-dry-goods",
  dairy: "produce-dry-goods",
  "dry-goods": "produce-dry-goods",
  equipment: "kitchen-equipment",
  packaging: "kitchen-equipment",
  seafood: "seafood",
  beverages: "beverages",
};

/** Look up which group a sub-category belongs to */
export function findGroupForCategory(
  value: string,
  groups: CategoryGroup[] = FALLBACK_CATEGORY_GROUPS
): CategoryGroup | undefined {
  return groups.find((g) => g.children.includes(value));
}

/** Get group label by language */
export function getGroupLabel(group: CategoryGroup, lang: "en" | "ja"): string {
  return lang === "ja" ? group.labelJa : group.labelEn;
}
