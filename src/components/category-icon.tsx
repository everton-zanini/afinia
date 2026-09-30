import {
  Baby,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Coins,
  Dog,
  Droplets,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Package,
  PartyPopper,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Repeat,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Tv,
  UtensilsCrossed,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CategoryIcon as IconName } from "@/lib/category-style";
import { cn } from "@/lib/utils";

export const ICONS: Record<IconName, LucideIcon> = {
  briefcase: Briefcase,
  sparkles: Sparkles,
  "piggy-bank": PiggyBank,
  home: Home,
  utensils: UtensilsCrossed,
  "shopping-cart": ShoppingCart,
  car: Car,
  fuel: Fuel,
  bus: Bus,
  "heart-pulse": HeartPulse,
  pill: Pill,
  "party-popper": PartyPopper,
  plane: Plane,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  repeat: Repeat,
  tv: Tv,
  smartphone: Smartphone,
  zap: Zap,
  droplets: Droplets,
  wifi: Wifi,
  shirt: Shirt,
  baby: Baby,
  dog: Dog,
  gift: Gift,
  dumbbell: Dumbbell,
  wrench: Wrench,
  landmark: Landmark,
  receipt: Receipt,
  package: Package,
  coins: Coins,
  tag: Tag,
};

/** Ícone da categoria em um círculo com a cor da categoria (decorativo; o nome sempre acompanha). */
export function CategoryBadge({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = ICONS[icon as IconName] ?? Tag;
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-white",
        size === "sm" && "size-7 [&_svg]:size-3.5",
        size === "md" && "size-10 [&_svg]:size-5",
        size === "lg" && "size-12 [&_svg]:size-6",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      <Icon />
    </span>
  );
}
