export const TRANSACTION_TYPES = ["INCOME", "EXPENSE", "TRANSFER"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const ACCOUNT_TYPES = [
  "BANK",
  "CASH",
  "CREDIT_CARD",
  "WALLET",
  "INVESTMENT",
  "LOAN",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const CATEGORY_KINDS = ["INCOME", "EXPENSE"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const BUCKETS = [
  "NEEDS",
  "LIFESTYLE",
  "SAVINGS",
  "INVESTMENTS",
  "EMERGENCY",
  "INCOME",
] as const;
export type Bucket = (typeof BUCKETS)[number];

export const FREQUENCIES = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const PAYMENT_METHODS = [
  "UPI",
  "CARD",
  "CASH",
  "NETBANKING",
  "AUTO_DEBIT",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  BANK: "Bank account",
  CASH: "Cash",
  CREDIT_CARD: "Credit card",
  WALLET: "UPI / Wallet",
  INVESTMENT: "Investment",
  LOAN: "Loan",
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  UPI: "UPI",
  CARD: "Card",
  CASH: "Cash",
  NETBANKING: "Net banking",
  AUTO_DEBIT: "Auto debit",
  OTHER: "Other",
};

/** Liabilities are subtracted from net worth instead of added. */
export const LIABILITY_ACCOUNT_TYPES: AccountType[] = ["CREDIT_CARD", "LOAN"];

export function isLiability(type: string): boolean {
  return LIABILITY_ACCOUNT_TYPES.includes(type as AccountType);
}

export interface AccountDTO {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  openingBalance: number;
  creditLimit: number | null;
  billingCycleDay: number | null;
  dueDay: number | null;
  icon: string;
  color: string;
  isLiquid: boolean;
  isArchived: boolean;
  sortOrder: number;
}

export interface CategoryDTO {
  id: string;
  name: string;
  kind: CategoryKind;
  bucket: Bucket;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface TransactionDTO {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  note: string | null;
  merchant: string | null;
  paymentMethod: PaymentMethod;
  excludeFromBudget: boolean;
  account: { id: string; name: string; type: AccountType; color: string };
  toAccount: {
    id: string;
    name: string;
    type: AccountType;
    color: string;
  } | null;
  category: { id: string; name: string; icon: string; color: string } | null;
}

export interface RecurringRuleDTO {
  id: string;
  name: string;
  type: TransactionType;
  amount: number;
  isVariable: boolean;
  frequency: Frequency;
  interval: number;
  dayOfMonth: number | null;
  weekday: number | null;
  monthOfYear: number | null;
  nextDueDate: string;
  autoPost: boolean;
  isBill: boolean;
  isActive: boolean;
  merchant: string | null;
  account: { id: string; name: string; color: string };
  toAccount: { id: string; name: string; color: string } | null;
  category: { id: string; name: string; icon: string; color: string } | null;
  /** Most recent payment recorded from this rule, if any. Drives "mark unpaid". */
  lastPosted: { id: string; date: string; amount: number } | null;
}

export interface BudgetDTO {
  id: string;
  period: string;
  amount: number;
  spent: number;
  remaining: number;
  progress: number;
  rollover: boolean;
  category: CategoryDTO;
}

export interface UpcomingItem {
  ruleId: string;
  name: string;
  amount: number;
  dueDate: string;
  type: TransactionType;
  isVariable: boolean;
  accountId: string;
  accountName: string;
  categoryName: string | null;
  daysUntil: number;
}

export interface SafeToSpend {
  liquidBalance: number;
  upcomingOutflows: number;
  plannedSavings: number;
  remainingBudgeted: number;
  safeTotal: number;
  perDay: number;
  daysRemaining: number;
  isNegative: boolean;
}

export interface MonthSummary {
  period: string;
  income: number;
  expense: number;
  saved: number;
  savingsRate: number;
}

/* ------------------------------------------------------------------ */
/* Khata — receivables and payables                                    */
/* ------------------------------------------------------------------ */

export const KHATA_ENTRY_TYPES = ["GAVE", "GOT"] as const;
export type KhataEntryType = (typeof KHATA_ENTRY_TYPES)[number];

export const PARTY_TYPES = ["CUSTOMER", "SUPPLIER"] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  CUSTOMER: "Customer",
  SUPPLIER: "Supplier",
};

export interface PartyDTO {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  type: PartyType;
  isArchived: boolean;
  /**
   * Net position in paise: positive means they owe you ("you will get"),
   * negative means you owe them ("you will give").
   */
  balance: number;
  lastActivity: string | null;
  entryCount: number;
}

export interface KhataEntryDTO {
  id: string;
  type: KhataEntryType;
  amount: number;
  date: string;
  note: string | null;
  dueDate: string | null;
  /** Party balance immediately after this entry, oldest-to-newest. */
  runningBalance: number;
}

export interface DueKhataItem {
  entryId: string;
  partyId: string;
  partyName: string;
  type: KhataEntryType;
  amount: number;
  dueDate: string;
}

export interface KhataSummary {
  toGet: number;
  toGive: number;
  net: number;
  partyCount: number;
}

/* ------------------------------------------------------------------ */
/* Groups (shared expenses)                                            */
/* ------------------------------------------------------------------ */

export const SPLIT_TYPES = ["EQUAL", "EXACT", "PERCENT"] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

export const SPLIT_TYPE_LABELS: Record<SplitType, string> = {
  EQUAL: "Equally",
  EXACT: "Exact amounts",
  PERCENT: "Percentages",
};

export interface GroupMemberDTO {
  id: string;
  name: string;
  phone: string | null;
  /** Only set on legacy email invites. */
  email: string | null;
  role: "OWNER" | "MEMBER";
  /** Legacy email invite that hasn't been accepted yet. */
  isPending: boolean;
  /** Left the group; kept only because past expenses reference them. */
  hasLeft: boolean;
  isYou: boolean;
  /** Paise. Positive: the group owes them. Negative: they owe the group. */
  balance: number;
}

/** A FinTrack account that can be added to a group. */
export interface GroupPersonDTO {
  id: string;
  name: string;
  phone: string;
  isYou?: boolean;
}

export interface GroupSummaryDTO {
  id: string;
  name: string;
  memberCount: number;
  pendingCount: number;
  yourBalance: number;
  lastActivity: string;
}

export interface GroupDebt {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export type GroupActivity =
  | {
      kind: "EXPENSE";
      id: string;
      date: string;
      description: string;
      amount: number;
      splitType: SplitType;
      paidBy: { id: string; name: string };
      shares: Array<{ memberId: string; name: string; amount: number }>;
      /** Your net effect: positive you lent, negative you borrowed. */
      yourNet: number;
    }
  | {
      kind: "SETTLEMENT";
      id: string;
      date: string;
      amount: number;
      from: { id: string; name: string };
      to: { id: string; name: string };
    };

export interface GroupDetailDTO {
  id: string;
  name: string;
  isOwner: boolean;
  youMemberId: string;
  members: GroupMemberDTO[];
  debts: GroupDebt[];
  activity: GroupActivity[];
  totalSpent: number;
}
