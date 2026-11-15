export type BillRow = {
  date: string;
  type: string;
  amountCents: number;
  category: string;
  account: string;
  counterAccount: string;
  currency: string;
  discountCents: number;
  remark: string;
};

export type CurrencyBreakdown = {
  currency: string;
  discountCents: number;
  windfallCents: number;
  couponCents: number;
};

export type CardCurrencyRate = {
  currency: string;
  spendCents: number;
  expenseDiscountCents: number;
  windfallCents: number;
  repaymentDiscountCents: number;
};

export type CardRate = {
  account: string;
  currencies: CardCurrencyRate[];
};

export type DiscountLine = {
  date: string;
  type: string;
  category: string;
  remark: string;
  account: string;
  amountCents: number;
  discountCents: number;
  sortCents: number;
  kind: "expense" | "windfall" | "transfer" | "repayment";
};

const CURRENCY_ORDER = ["CNY", "HKD", "USD", "MOP", "TRY"];

export function moneyToCents(value: unknown): number {
  const text = String(value ?? "")
    .trim()
    .replace(/,/g, "");
  if (!text) return 0;
  const amount = Number(text);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function monthKey(date: string): string {
  const match = date.trim().match(/^(\d{4})[/.\-年](\d{1,2})/);
  if (!match) return "未知";
  return `${match[1]}/${match[2].padStart(2, "0")}`;
}

export function formatMonth(month: string): string {
  const match = month.match(/^(\d{4})\/(\d{2})$/);
  if (!match) return month;
  return `${match[1]}年${Number(match[2])}月`;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export function totalCents(item: CurrencyBreakdown): number {
  return item.discountCents + item.windfallCents - item.couponCents;
}

export function formatRate(partCents: number, spendCents: number): string {
  if (spendCents === 0) return "—";
  return `${((partCents / spendCents) * 100).toFixed(2)}%`;
}

function compareCurrency(left: string, right: string): number {
  const leftIndex = CURRENCY_ORDER.indexOf(left);
  const rightIndex = CURRENCY_ORDER.indexOf(right);
  if (leftIndex !== -1 || rightIndex !== -1) {
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  }
  return left.localeCompare(right, "zh-CN");
}

export function listMonths(rows: BillRow[]): string[] {
  return [...new Set(rows.map((row) => monthKey(row.date)))].sort();
}

export function countMonth(rows: BillRow[], month: string): number {
  return rows.filter((row) => monthKey(row.date) === month).length;
}

export function summarizeMonth(rows: BillRow[], month: string): CurrencyBreakdown[] {
  const totals = new Map<string, CurrencyBreakdown>();

  for (const row of rows) {
    if (monthKey(row.date) !== month) continue;
    const current = totals.get(row.currency) ?? {
      currency: row.currency,
      discountCents: 0,
      windfallCents: 0,
      couponCents: 0,
    };
    const paidCoupon = row.type === "支出" && row.category === "付费卡券";
    if (!paidCoupon) current.discountCents += row.discountCents;
    if (row.type === "收入" && row.category === "意外收入") {
      current.windfallCents += row.amountCents;
    }
    if (paidCoupon) current.couponCents += Math.abs(row.amountCents);
    totals.set(row.currency, current);
  }

  return [...totals.values()].sort((left, right) =>
    compareCurrency(left.currency, right.currency),
  );
}

export function discountLines(rows: BillRow[], month: string, currency: string): DiscountLine[] {
  const lines: DiscountLine[] = [];
  for (const row of rows) {
    if (monthKey(row.date) !== month || row.currency !== currency) continue;
    const windfall = row.type === "收入" && row.category === "意外收入";
    const expense = row.type === "支出";
    const transfer = row.type === "转账";
    const repayment = row.type === "还款";
    if (!windfall && !expense && !transfer && !repayment) continue;
    const kind = windfall ? "windfall" : transfer ? "transfer" : repayment ? "repayment" : "expense";
    lines.push({
      date: row.date,
      type: row.type,
      category: row.category,
      remark: row.remark,
      account: row.account,
      amountCents: row.amountCents,
      discountCents: row.discountCents,
      sortCents: windfall ? row.amountCents : row.discountCents,
      kind,
    });
  }
  const visible = lines.filter((line) => line.sortCents !== 0);
  return visible.sort(
    (left, right) => right.sortCents - left.sortCents || right.date.localeCompare(left.date),
  );
}

export function summarizeCreditCards(rows: BillRow[], month: string): CardRate[] {
  const monthRows = rows.filter((row) => monthKey(row.date) === month);
  const cards = new Map<string, Map<string, CardCurrencyRate>>();

  for (const row of monthRows) {
    if (row.type !== "支出" || !row.account.includes("信用卡")) continue;
    const byCurrency = cards.get(row.account) ?? new Map<string, CardCurrencyRate>();
    const current = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      spendCents: 0,
      expenseDiscountCents: 0,
      windfallCents: 0,
      repaymentDiscountCents: 0,
    };
    current.spendCents += row.amountCents;
    current.expenseDiscountCents += row.discountCents;
    byCurrency.set(row.currency, current);
    cards.set(row.account, byCurrency);
  }

  for (const row of monthRows) {
    if (row.type !== "收入" || row.category !== "意外收入") continue;
    const current = cards.get(row.account)?.get(row.currency);
    if (!current) continue;
    current.windfallCents += row.amountCents;
  }

  for (const row of monthRows) {
    if (row.type !== "还款") continue;
    const current = cards.get(row.counterAccount)?.get(row.currency);
    if (!current) continue;
    current.repaymentDiscountCents += row.discountCents;
  }

  return [...cards.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "zh-CN"))
    .map(([account, byCurrency]) => ({
      account,
      currencies: [...byCurrency.values()]
        .map((item) => ({ ...item, spendCents: Math.abs(item.spendCents) }))
        .sort((left, right) => compareCurrency(left.currency, right.currency)),
    }));
}

export async function parseBillFile(file: File): Promise<BillRow[]> {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    throw new Error("请上传 xlsx 或 csv 文件");
  }

  const xlsx = await import("xlsx");
  const workbook = xlsx.read(await file.arrayBuffer(), { type: "array" });
  const sheetName =
    workbook.SheetNames.find((name) => name === "收支账单") ?? workbook.SheetNames[0];
  if (!sheetName) throw new Error("文件里没有工作表");

  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: "",
  });
  if (rows.length === 0) throw new Error("表格是空的");

  const required = ["日期", "类型", "金额", "一级分类", "账户1", "账户2", "货币", "优惠"];
  const missing = required.filter((key) => !(key in rows[0]));
  if (missing.length > 0) {
    throw new Error(`缺少列：${missing.join("、")}`);
  }

  return rows.map((row) => ({
    date: String(row["日期"] ?? ""),
    type: String(row["类型"] ?? "").trim(),
    amountCents: moneyToCents(row["金额"]),
    category: String(row["一级分类"] ?? "").trim(),
    account: String(row["账户1"] ?? "").trim(),
    counterAccount: String(row["账户2"] ?? "").trim(),
    currency: String(row["货币"] ?? "").trim() || "(空)",
    discountCents: moneyToCents(row["优惠"]),
    remark: String(row["备注"] ?? "").trim(),
  }));
}
