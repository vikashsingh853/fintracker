import "server-only";
import { prisma } from "./prisma";

/** India-first starter categories every new account begins with. */
const EXPENSE_CATEGORIES = [
  { name: "Rent", bucket: "NEEDS", icon: "home", color: "#dc2626" },
  { name: "Groceries", bucket: "NEEDS", icon: "shopping-basket", color: "#16a34a" },
  { name: "Food & Dining", bucket: "LIFESTYLE", icon: "utensils", color: "#ea580c" },
  { name: "Transport & Fuel", bucket: "NEEDS", icon: "car", color: "#0891b2" },
  { name: "Utilities", bucket: "NEEDS", icon: "zap", color: "#ca8a04" },
  { name: "Mobile & Internet", bucket: "NEEDS", icon: "wifi", color: "#2563eb" },
  { name: "Health & Medical", bucket: "NEEDS", icon: "heart-pulse", color: "#e11d48" },
  { name: "Shopping", bucket: "LIFESTYLE", icon: "shopping-bag", color: "#c026d3" },
  { name: "Entertainment", bucket: "LIFESTYLE", icon: "clapperboard", color: "#7c3aed" },
  { name: "Subscriptions", bucket: "LIFESTYLE", icon: "repeat", color: "#0d9488" },
  { name: "Insurance", bucket: "NEEDS", icon: "shield", color: "#475569" },
  { name: "Loan EMI", bucket: "NEEDS", icon: "landmark", color: "#b91c1c" },
  { name: "Investments & SIP", bucket: "INVESTMENTS", icon: "trending-up", color: "#6d28d9" },
  { name: "Education", bucket: "NEEDS", icon: "graduation-cap", color: "#1d4ed8" },
  { name: "Travel", bucket: "LIFESTYLE", icon: "plane", color: "#0284c7" },
  { name: "Domestic Help", bucket: "NEEDS", icon: "users", color: "#78716c" },
  { name: "Gifts & Donations", bucket: "LIFESTYLE", icon: "gift", color: "#db2777" },
  { name: "Miscellaneous", bucket: "LIFESTYLE", icon: "circle-ellipsis", color: "#64748b" },
];

const INCOME_CATEGORIES = [
  { name: "Salary", bucket: "INCOME", icon: "wallet", color: "#15803d" },
  { name: "Freelance", bucket: "INCOME", icon: "laptop", color: "#0d9488" },
  { name: "Interest & Dividends", bucket: "INCOME", icon: "percent", color: "#ca8a04" },
  { name: "Cashback & Refunds", bucket: "INCOME", icon: "rotate-ccw", color: "#2563eb" },
];

/**
 * Gives a brand-new account enough structure to be usable immediately:
 * the standard category set plus a bank and cash account to log against.
 */
export async function provisionNewUser(userId: string) {
  const categories = [
    ...EXPENSE_CATEGORIES.map((c, i) => ({ ...c, kind: "EXPENSE", sortOrder: i })),
    ...INCOME_CATEGORIES.map((c, i) => ({
      ...c,
      kind: "INCOME",
      sortOrder: EXPENSE_CATEGORIES.length + i,
    })),
  ];

  await prisma.category.createMany({
    data: categories.map((c) => ({
      userId,
      name: c.name,
      kind: c.kind,
      bucket: c.bucket,
      icon: c.icon,
      color: c.color,
      isSystem: true,
      sortOrder: c.sortOrder,
    })),
  });

  await prisma.account.createMany({
    data: [
      {
        userId,
        name: "Bank account",
        type: "BANK",
        icon: "landmark",
        color: "#1e40af",
        sortOrder: 1,
      },
      {
        userId,
        name: "Cash",
        type: "CASH",
        icon: "banknote",
        color: "#15803d",
        sortOrder: 2,
      },
    ],
  });
}
