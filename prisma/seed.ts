import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

// Seeding runs from the CLI, so it uses the direct connection when available.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Set DATABASE_URL (and ideally DIRECT_URL) before seeding.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEMO_PHONE = "9876543210";
const DEMO_PASSWORD = "fintrack123";

const rupees = (n: number) => BigInt(Math.round(n * 100));

const now = new Date();
const YEAR = now.getFullYear();
const MONTH = now.getMonth();

/** Builds a date in the current month (offset 0) or a previous month. */
function day(dayOfMonth: number, monthOffset = 0) {
  const d = new Date(YEAR, MONTH + monthOffset, dayOfMonth, 10, 0, 0);
  return d;
}

function lastDayOfMonth(monthOffset = 0) {
  return new Date(YEAR, MONTH + monthOffset + 1, 0).getDate();
}

function clampDay(dayOfMonth: number, monthOffset = 0) {
  return Math.min(dayOfMonth, lastDayOfMonth(monthOffset));
}

async function main() {
  console.log("Seeding FinTrack…");

  await prisma.user.deleteMany({ where: { phone: DEMO_PHONE } });

  const user = await prisma.user.create({
    data: {
      phone: DEMO_PHONE,
      passwordHash: await hash(DEMO_PASSWORD, 12),
      email: "demo@fintrack.in",
      name: "Vikash",
      monthlyIncome: rupees(92_000),
      savingsTargetPct: 25,
    },
  });

  // ---------- Accounts ----------
  const accountSeed = [
    {
      key: "hdfc",
      name: "HDFC Salary A/c",
      type: "BANK",
      openingBalance: rupees(48_200),
      icon: "landmark",
      color: "#1e40af",
      sortOrder: 1,
    },
    {
      key: "icici",
      name: "ICICI Savings",
      type: "BANK",
      openingBalance: rupees(65_000),
      icon: "piggy-bank",
      color: "#b45309",
      sortOrder: 2,
    },
    {
      key: "cash",
      name: "Cash",
      type: "CASH",
      openingBalance: rupees(3_500),
      icon: "banknote",
      color: "#15803d",
      sortOrder: 3,
    },
    {
      key: "upi",
      name: "Paytm Wallet",
      type: "WALLET",
      openingBalance: rupees(1_250),
      icon: "smartphone",
      color: "#0e7490",
      sortOrder: 4,
    },
    {
      key: "cc",
      name: "HDFC Regalia Credit Card",
      type: "CREDIT_CARD",
      openingBalance: rupees(0),
      creditLimit: rupees(2_50_000),
      billingCycleDay: 18,
      dueDay: 5,
      icon: "credit-card",
      color: "#9f1239",
      isLiquid: false,
      sortOrder: 5,
    },
    {
      key: "mf",
      name: "Groww Mutual Funds",
      type: "INVESTMENT",
      openingBalance: rupees(3_85_000),
      icon: "trending-up",
      color: "#6d28d9",
      isLiquid: false,
      sortOrder: 6,
    },
  ] as const;

  const accounts: Record<string, string> = {};
  for (const a of accountSeed) {
    const created = await prisma.account.create({
      data: {
        userId: user.id,
        name: a.name,
        type: a.type,
        openingBalance: a.openingBalance,
        creditLimit: "creditLimit" in a ? a.creditLimit : null,
        billingCycleDay: "billingCycleDay" in a ? a.billingCycleDay : null,
        dueDay: "dueDay" in a ? a.dueDay : null,
        icon: a.icon,
        color: a.color,
        isLiquid: "isLiquid" in a ? a.isLiquid : true,
        sortOrder: a.sortOrder,
      },
    });
    accounts[a.key] = created.id;
  }

  // ---------- Categories ----------
  const expenseCategories = [
    { key: "rent", name: "Rent", bucket: "NEEDS", icon: "home", color: "#dc2626" },
    { key: "groceries", name: "Groceries", bucket: "NEEDS", icon: "shopping-basket", color: "#16a34a" },
    { key: "food", name: "Food & Dining", bucket: "LIFESTYLE", icon: "utensils", color: "#ea580c" },
    { key: "transport", name: "Transport & Fuel", bucket: "NEEDS", icon: "car", color: "#0891b2" },
    { key: "utilities", name: "Utilities", bucket: "NEEDS", icon: "zap", color: "#ca8a04" },
    { key: "mobile", name: "Mobile & Internet", bucket: "NEEDS", icon: "wifi", color: "#2563eb" },
    { key: "health", name: "Health & Medical", bucket: "NEEDS", icon: "heart-pulse", color: "#e11d48" },
    { key: "shopping", name: "Shopping", bucket: "LIFESTYLE", icon: "shopping-bag", color: "#c026d3" },
    { key: "entertainment", name: "Entertainment", bucket: "LIFESTYLE", icon: "clapperboard", color: "#7c3aed" },
    { key: "subscriptions", name: "Subscriptions", bucket: "LIFESTYLE", icon: "repeat", color: "#0d9488" },
    { key: "insurance", name: "Insurance", bucket: "NEEDS", icon: "shield", color: "#475569" },
    { key: "emi", name: "Loan EMI", bucket: "NEEDS", icon: "landmark", color: "#b91c1c" },
    { key: "investments", name: "Investments & SIP", bucket: "INVESTMENTS", icon: "trending-up", color: "#6d28d9" },
    { key: "education", name: "Education", bucket: "NEEDS", icon: "graduation-cap", color: "#1d4ed8" },
    { key: "travel", name: "Travel", bucket: "LIFESTYLE", icon: "plane", color: "#0284c7" },
    { key: "help", name: "Domestic Help", bucket: "NEEDS", icon: "users", color: "#78716c" },
    { key: "gifts", name: "Gifts & Donations", bucket: "LIFESTYLE", icon: "gift", color: "#db2777" },
    { key: "misc", name: "Miscellaneous", bucket: "LIFESTYLE", icon: "circle-ellipsis", color: "#64748b" },
  ] as const;

  const incomeCategories = [
    { key: "salary", name: "Salary", bucket: "INCOME", icon: "wallet", color: "#15803d" },
    { key: "freelance", name: "Freelance", bucket: "INCOME", icon: "laptop", color: "#0d9488" },
    { key: "interest", name: "Interest & Dividends", bucket: "INCOME", icon: "percent", color: "#ca8a04" },
    { key: "refund", name: "Cashback & Refunds", bucket: "INCOME", icon: "rotate-ccw", color: "#2563eb" },
  ] as const;

  const categories: Record<string, string> = {};
  let order = 0;
  for (const c of expenseCategories) {
    const created = await prisma.category.create({
      data: {
        userId: user.id,
        name: c.name,
        kind: "EXPENSE",
        bucket: c.bucket,
        icon: c.icon,
        color: c.color,
        isSystem: true,
        sortOrder: order++,
      },
    });
    categories[c.key] = created.id;
  }
  for (const c of incomeCategories) {
    const created = await prisma.category.create({
      data: {
        userId: user.id,
        name: c.name,
        kind: "INCOME",
        bucket: c.bucket,
        icon: c.icon,
        color: c.color,
        isSystem: true,
        sortOrder: order++,
      },
    });
    categories[c.key] = created.id;
  }

  // ---------- Transactions ----------
  type TxSeed = {
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    amount: number;
    day: number;
    monthOffset: number;
    account: string;
    toAccount?: string;
    category?: string;
    merchant?: string;
    note?: string;
    method?: string;
  };

  const txs: TxSeed[] = [];

  // Two months of history: previous month (-1) and the current month.
  for (const monthOffset of [-1, 0]) {
    const isCurrent = monthOffset === 0;

    txs.push({
      type: "INCOME",
      amount: 92_000,
      day: 1,
      monthOffset,
      account: "hdfc",
      category: "salary",
      merchant: "Acme Technologies Pvt Ltd",
      note: "Monthly salary",
      method: "NETBANKING",
    });

    txs.push({
      type: "EXPENSE",
      amount: 24_000,
      day: 5,
      monthOffset,
      account: "hdfc",
      category: "rent",
      merchant: "Landlord",
      note: "Flat rent",
      method: "UPI",
    });

    txs.push({
      type: "TRANSFER",
      amount: 15_000,
      day: 3,
      monthOffset,
      account: "hdfc",
      toAccount: "mf",
      note: "SIP — Parag Parikh Flexi Cap",
      method: "AUTO_DEBIT",
    });

    txs.push({
      type: "TRANSFER",
      amount: 10_000,
      day: 3,
      monthOffset,
      account: "hdfc",
      toAccount: "icici",
      note: "Emergency fund top-up",
      method: "NETBANKING",
    });

    txs.push({
      type: "EXPENSE",
      amount: 399,
      day: 8,
      monthOffset,
      account: "cc",
      category: "subscriptions",
      merchant: "Netflix",
      method: "CARD",
    });
    txs.push({
      type: "EXPENSE",
      amount: 1_499,
      day: 12,
      monthOffset,
      account: "hdfc",
      category: "mobile",
      merchant: "Airtel Fiber",
      method: "AUTO_DEBIT",
    });
    txs.push({
      type: "EXPENSE",
      amount: 349,
      day: 14,
      monthOffset,
      account: "hdfc",
      category: "mobile",
      merchant: "Jio Prepaid",
      method: "UPI",
    });
    txs.push({
      type: "EXPENSE",
      amount: monthOffset === 0 ? 2_180 : 1_760,
      day: 10,
      monthOffset,
      account: "hdfc",
      category: "utilities",
      merchant: "BESCOM Electricity",
      method: "UPI",
    });
    txs.push({
      type: "EXPENSE",
      amount: 3_000,
      day: 2,
      monthOffset,
      account: "cash",
      category: "help",
      merchant: "House help",
      method: "CASH",
    });
    txs.push({
      type: "EXPENSE",
      amount: 1_800,
      day: 7,
      monthOffset,
      account: "hdfc",
      category: "insurance",
      merchant: "LIC Term Plan",
      method: "AUTO_DEBIT",
    });

    // Groceries — weekly-ish.
    const groceryRuns = isCurrent
      ? [{ d: 4, a: 2_450 }, { d: 11, a: 3_120 }, { d: 17, a: 2_680 }]
      : [{ d: 4, a: 2_200 }, { d: 11, a: 2_900 }, { d: 18, a: 2_350 }, { d: 25, a: 2_540 }];
    for (const g of groceryRuns) {
      txs.push({
        type: "EXPENSE",
        amount: g.a,
        day: g.d,
        monthOffset,
        account: "upi",
        category: "groceries",
        merchant: "BigBasket",
        method: "UPI",
      });
    }

    // Food & dining — the category the AI coach will flag.
    const diningRuns = isCurrent
      ? [
          { d: 2, a: 640, m: "Swiggy" },
          { d: 5, a: 1_280, m: "Third Wave Coffee" },
          { d: 8, a: 890, m: "Zomato" },
          { d: 11, a: 1_540, m: "Toit Brewpub" },
          { d: 13, a: 420, m: "Swiggy Instamart" },
          { d: 15, a: 980, m: "Zomato" },
        ]
      : [
          { d: 3, a: 560, m: "Swiggy" },
          { d: 9, a: 720, m: "Zomato" },
          { d: 16, a: 1_150, m: "Barbeque Nation" },
          { d: 22, a: 610, m: "Swiggy" },
          { d: 27, a: 840, m: "Zomato" },
        ];
    for (const f of diningRuns) {
      txs.push({
        type: "EXPENSE",
        amount: f.a,
        day: f.d,
        monthOffset,
        account: f.d % 2 === 0 ? "upi" : "cc",
        category: "food",
        merchant: f.m,
        method: f.d % 2 === 0 ? "UPI" : "CARD",
      });
    }

    // Transport
    const rides = isCurrent
      ? [{ d: 3, a: 320 }, { d: 9, a: 1_800 }, { d: 14, a: 280 }]
      : [{ d: 6, a: 410 }, { d: 13, a: 1_950 }, { d: 21, a: 360 }, { d: 28, a: 290 }];
    for (const r of rides) {
      txs.push({
        type: "EXPENSE",
        amount: r.a,
        day: r.d,
        monthOffset,
        account: "upi",
        category: "transport",
        merchant: r.a > 1_000 ? "Indian Oil" : "Uber",
        method: "UPI",
      });
    }

    if (isCurrent) {
      txs.push({
        type: "EXPENSE",
        amount: 4_299,
        day: 12,
        monthOffset,
        account: "cc",
        category: "shopping",
        merchant: "Myntra",
        method: "CARD",
      });
      txs.push({
        type: "INCOME",
        amount: 1_200,
        day: 14,
        monthOffset,
        account: "hdfc",
        category: "refund",
        merchant: "Amazon refund",
        method: "NETBANKING",
      });
    } else {
      txs.push({
        type: "EXPENSE",
        amount: 6_800,
        day: 19,
        monthOffset,
        account: "cc",
        category: "shopping",
        merchant: "Croma",
        method: "CARD",
      });
      txs.push({
        type: "EXPENSE",
        amount: 2_400,
        day: 23,
        monthOffset,
        account: "cc",
        category: "entertainment",
        merchant: "PVR Cinemas",
        method: "CARD",
      });
      txs.push({
        type: "INCOME",
        amount: 18_000,
        day: 20,
        monthOffset,
        account: "icici",
        category: "freelance",
        merchant: "Design retainer",
        method: "NETBANKING",
      });
      txs.push({
        type: "INCOME",
        amount: 2_340,
        day: 28,
        monthOffset,
        account: "icici",
        category: "interest",
        merchant: "Savings interest",
        method: "NETBANKING",
      });
      // Previous month's credit card bill was cleared.
      txs.push({
        type: "TRANSFER",
        amount: 9_200,
        day: 26,
        monthOffset,
        account: "hdfc",
        toAccount: "cc",
        note: "Credit card bill payment",
        method: "NETBANKING",
      });
    }
  }

  for (const t of txs) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: t.type,
        amount: rupees(t.amount),
        date: day(clampDay(t.day, t.monthOffset), t.monthOffset),
        note: t.note ?? null,
        merchant: t.merchant ?? null,
        accountId: accounts[t.account],
        toAccountId: t.toAccount ? accounts[t.toAccount] : null,
        categoryId: t.category ? categories[t.category] : null,
        paymentMethod: t.method ?? "UPI",
        excludeFromBudget: t.type === "TRANSFER",
      },
    });
  }

  // ---------- Budgets (current + previous month) ----------
  const budgetSeed = [
    { category: "rent", amount: 24_000 },
    { category: "groceries", amount: 12_000 },
    { category: "food", amount: 6_000 },
    { category: "transport", amount: 4_000 },
    { category: "utilities", amount: 2_500 },
    { category: "mobile", amount: 2_000 },
    { category: "shopping", amount: 5_000 },
    { category: "entertainment", amount: 2_500 },
    { category: "subscriptions", amount: 1_200 },
    { category: "health", amount: 2_000 },
  ];

  const currentPeriod = `${YEAR}-${String(MONTH + 1).padStart(2, "0")}`;
  const prevDate = new Date(YEAR, MONTH - 1, 1);
  const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  for (const period of [prevPeriod, currentPeriod]) {
    for (const b of budgetSeed) {
      await prisma.budget.create({
        data: {
          userId: user.id,
          categoryId: categories[b.category],
          period,
          amount: rupees(b.amount),
        },
      });
    }
  }

  // ---------- Recurring rules / bills ----------
  const recurringSeed = [
    {
      name: "Flat rent",
      type: "EXPENSE",
      amount: 24_000,
      account: "hdfc",
      category: "rent",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      autoPost: false,
      merchant: "Landlord",
    },
    {
      name: "SIP — Parag Parikh Flexi Cap",
      type: "TRANSFER",
      amount: 15_000,
      account: "hdfc",
      toAccount: "mf",
      frequency: "MONTHLY",
      dayOfMonth: 3,
      autoPost: true,
      isBill: false,
      merchant: "Groww",
    },
    {
      name: "Netflix",
      type: "EXPENSE",
      amount: 399,
      account: "cc",
      category: "subscriptions",
      frequency: "MONTHLY",
      dayOfMonth: 8,
      autoPost: true,
      merchant: "Netflix",
    },
    {
      name: "Airtel Fiber",
      type: "EXPENSE",
      amount: 1_499,
      account: "hdfc",
      category: "mobile",
      frequency: "MONTHLY",
      dayOfMonth: 12,
      autoPost: true,
      merchant: "Airtel",
    },
    {
      name: "Jio Prepaid",
      type: "EXPENSE",
      amount: 349,
      account: "hdfc",
      category: "mobile",
      frequency: "MONTHLY",
      dayOfMonth: 14,
      autoPost: false,
      merchant: "Jio",
    },
    {
      name: "BESCOM Electricity",
      type: "EXPENSE",
      amount: 2_000,
      account: "hdfc",
      category: "utilities",
      frequency: "MONTHLY",
      dayOfMonth: 10,
      autoPost: false,
      isVariable: true,
      merchant: "BESCOM",
    },
    {
      name: "LIC Term Plan",
      type: "EXPENSE",
      amount: 1_800,
      account: "hdfc",
      category: "insurance",
      frequency: "MONTHLY",
      dayOfMonth: 7,
      autoPost: true,
      merchant: "LIC",
    },
    {
      name: "House help salary",
      type: "EXPENSE",
      amount: 3_000,
      account: "cash",
      category: "help",
      frequency: "MONTHLY",
      dayOfMonth: 2,
      autoPost: false,
      merchant: "House help",
    },
    {
      name: "Credit card bill",
      type: "TRANSFER",
      amount: 9_000,
      account: "hdfc",
      toAccount: "cc",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      autoPost: false,
      isVariable: true,
      merchant: "HDFC Regalia",
    },
    {
      name: "Amazon Prime",
      type: "EXPENSE",
      amount: 1_499,
      account: "cc",
      category: "subscriptions",
      frequency: "YEARLY",
      dayOfMonth: 22,
      monthOfYear: MONTH + 1,
      autoPost: true,
      merchant: "Amazon",
    },
  ] as const;

  for (const r of recurringSeed) {
    const targetDay = clampDay(r.dayOfMonth, 0);
    const thisMonth = day(targetDay, 0);
    // If this month's date has passed, the rule is next due next month.
    const nextDue =
      thisMonth >= new Date(YEAR, MONTH, now.getDate(), 0, 0, 0)
        ? thisMonth
        : day(clampDay(r.dayOfMonth, 1), 1);

    await prisma.recurringRule.create({
      data: {
        userId: user.id,
        name: r.name,
        type: r.type,
        amount: rupees(r.amount),
        isVariable: "isVariable" in r ? r.isVariable : false,
        accountId: accounts[r.account],
        toAccountId: "toAccount" in r && r.toAccount ? accounts[r.toAccount] : null,
        categoryId: "category" in r && r.category ? categories[r.category] : null,
        frequency: r.frequency,
        dayOfMonth: r.dayOfMonth,
        monthOfYear: "monthOfYear" in r ? r.monthOfYear : null,
        startDate: day(targetDay, -2),
        nextDueDate: nextDue,
        autoPost: r.autoPost,
        isBill: "isBill" in r ? r.isBill : true,
        merchant: r.merchant,
      },
    });
  }

  // ---------- Goals (Phase 2 surface, seeded so Safe to Spend is realistic) ----------
  const goalSeed = [
    {
      name: "Emergency fund",
      icon: "shield",
      target: 3_00_000,
      saved: 1_05_000,
      monthly: 10_000,
      account: "icici",
      months: 20,
      priority: 1,
    },
    {
      name: "Goa vacation",
      icon: "plane",
      target: 80_000,
      saved: 22_000,
      monthly: 6_000,
      account: "icici",
      months: 10,
      priority: 2,
    },
    {
      name: "New iPhone",
      icon: "smartphone",
      target: 1_20_000,
      saved: 35_000,
      monthly: 5_000,
      account: "icici",
      months: 17,
      priority: 3,
    },
  ];

  for (const g of goalSeed) {
    await prisma.goal.create({
      data: {
        userId: user.id,
        name: g.name,
        icon: g.icon,
        targetAmount: rupees(g.target),
        savedAmount: rupees(g.saved),
        monthlyContribution: rupees(g.monthly),
        targetDate: new Date(YEAR, MONTH + g.months, 1),
        accountId: accounts[g.account],
        priority: g.priority,
      },
    });
  }

  // ---------- Khata (udhaar ledger) ----------
  // Convention: GAVE = you handed over money/goods, GOT = you received them.
  // So a shop supplying you on credit is a GOT entry, which you later clear
  // with a GAVE entry when you pay.
  const khataSeed = [
    {
      name: "Ramesh Kirana Store",
      phone: "9845012345",
      type: "SUPPLIER",
      note: "Monthly grocery account",
      entries: [
        { type: "GOT", amount: 4_500, day: 2, monthOffset: -1, note: "Provisions on credit" },
        { type: "GAVE", amount: 4_500, day: 8, monthOffset: -1, note: "Cleared by UPI" },
        { type: "GOT", amount: 3_200, day: 4, monthOffset: 0, note: "This month's provisions" },
      ],
    },
    {
      name: "Suresh (colleague)",
      phone: "9900112233",
      type: "CUSTOMER",
      note: "Lent for bike repair",
      entries: [
        { type: "GAVE", amount: 8_000, day: 6, monthOffset: 0, note: "Bike repair loan" },
        { type: "GOT", amount: 3_000, day: 14, monthOffset: 0, note: "Part payment" },
      ],
    },
    {
      name: "Anita Sharma",
      phone: "9812233445",
      type: "CUSTOMER",
      note: "Tuition fees",
      entries: [
        { type: "GAVE", amount: 6_000, day: 5, monthOffset: 0, note: "Tuition for this month" },
      ],
    },
    {
      name: "Milk vendor",
      type: "SUPPLIER",
      note: "Daily delivery, settled monthly",
      entries: [
        { type: "GAVE", amount: 1_800, day: 1, monthOffset: 0, note: "Advance paid" },
        { type: "GOT", amount: 2_400, day: 16, monthOffset: 0, note: "This month's milk" },
      ],
    },
  ] as const;

  for (const p of khataSeed) {
    const party = await prisma.party.create({
      data: {
        userId: user.id,
        name: p.name,
        phone: "phone" in p ? p.phone : null,
        type: p.type,
        note: p.note,
      },
    });

    for (const e of p.entries) {
      await prisma.khataEntry.create({
        data: {
          userId: user.id,
          partyId: party.id,
          type: e.type,
          amount: rupees(e.amount),
          date: day(clampDay(e.day, e.monthOffset), e.monthOffset),
          note: e.note,
        },
      });
    }
  }

  const counts = {
    accounts: await prisma.account.count({ where: { userId: user.id } }),
    categories: await prisma.category.count({ where: { userId: user.id } }),
    transactions: await prisma.transaction.count({ where: { userId: user.id } }),
    budgets: await prisma.budget.count({ where: { userId: user.id } }),
    recurring: await prisma.recurringRule.count({ where: { userId: user.id } }),
    goals: await prisma.goal.count({ where: { userId: user.id } }),
    khataParties: await prisma.party.count({ where: { userId: user.id } }),
    khataEntries: await prisma.khataEntry.count({ where: { userId: user.id } }),
  };

  console.log("Seed complete:", counts);
  console.log(`Demo login — phone: ${DEMO_PHONE}  password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
