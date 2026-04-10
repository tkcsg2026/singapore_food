/**
 * Supplier category group definitions.
 * Each sub-category belongs to exactly one parent group.
 */

export interface CategoryGroup {
  key: string;
  labelEn: string;
  labelJa: string;
  /** Ordered list of sub-category values belonging to this group */
  children: string[];
}

export const SUPPLIER_CATEGORY_GROUPS: CategoryGroup[] = [
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

/** Map from old category value → new category value (for backward compatibility) */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  meat: "meat-poultry",
  vegetables: "produce-dry-goods",
  dairy: "produce-dry-goods",
  "dry-goods": "produce-dry-goods",
  equipment: "kitchen-equipment",
  packaging: "kitchen-equipment",
  // These stay the same
  seafood: "seafood",
  beverages: "beverages",
};

/** Look up which group a sub-category belongs to */
export function findGroupForCategory(value: string): CategoryGroup | undefined {
  return SUPPLIER_CATEGORY_GROUPS.find((g) => g.children.includes(value));
}

/** Get group label by language */
export function getGroupLabel(group: CategoryGroup, lang: "en" | "ja"): string {
  return lang === "ja" ? group.labelJa : group.labelEn;
}
