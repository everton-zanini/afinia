// Ícones e cores permitidos para categorias (valores persistidos como texto).

export const CATEGORY_ICONS = [
  "briefcase",
  "sparkles",
  "piggy-bank",
  "home",
  "utensils",
  "shopping-cart",
  "car",
  "fuel",
  "bus",
  "heart-pulse",
  "pill",
  "party-popper",
  "plane",
  "graduation-cap",
  "book-open",
  "repeat",
  "tv",
  "smartphone",
  "zap",
  "droplets",
  "wifi",
  "shirt",
  "baby",
  "dog",
  "gift",
  "dumbbell",
  "wrench",
  "landmark",
  "receipt",
  "package",
  "coins",
  "tag",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const CATEGORY_COLORS = [
  "#0e6b69",
  "#13795b",
  "#3f8f5a",
  "#5b7fb8",
  "#3f5b8c",
  "#8a6bb0",
  "#b0508a",
  "#c2573f",
  "#b3412c",
  "#c07a12",
  "#8a6d1f",
  "#5f6b6a",
] as const;

export function isCategoryIcon(value: string): value is CategoryIcon {
  return (CATEGORY_ICONS as readonly string[]).includes(value);
}

export function isCategoryColor(value: string): boolean {
  return (CATEGORY_COLORS as readonly string[]).includes(value);
}

export const SUGGESTED_CATEGORIES: { kind: "INCOME" | "EXPENSE"; name: string; icon: CategoryIcon; color: string }[] = [
  { kind: "INCOME", name: "Salários", icon: "briefcase", color: "#13795b" },
  { kind: "INCOME", name: "Trabalhos extras", icon: "sparkles", color: "#0e6b69" },
  { kind: "INCOME", name: "Outras receitas", icon: "piggy-bank", color: "#3f8f5a" },
  { kind: "EXPENSE", name: "Moradia", icon: "home", color: "#5b7fb8" },
  { kind: "EXPENSE", name: "Alimentação", icon: "utensils", color: "#c07a12" },
  { kind: "EXPENSE", name: "Transporte", icon: "car", color: "#3f5b8c" },
  { kind: "EXPENSE", name: "Saúde", icon: "heart-pulse", color: "#c2573f" },
  { kind: "EXPENSE", name: "Lazer", icon: "party-popper", color: "#8a6bb0" },
  { kind: "EXPENSE", name: "Educação", icon: "graduation-cap", color: "#0e6b69" },
  { kind: "EXPENSE", name: "Assinaturas", icon: "repeat", color: "#b0508a" },
  { kind: "EXPENSE", name: "Outras despesas", icon: "package", color: "#5f6b6a" },
];
