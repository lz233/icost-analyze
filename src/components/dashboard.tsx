"use client";

import { useMemo, useRef, useState } from "react";
import {
  countMonth,
  discountLines,
  formatCents,
  formatMonth,
  formatRate,
  listMonths,
  parseBillFile,
  summarizeCreditCards,
  summarizeMonth,
  totalCents,
  type BillRow,
} from "@/lib/bill";

const NAV = [
  { id: "stats", label: "账单统计" },
  { id: "settings", label: "设置" },
] as const;

type NavId = (typeof NAV)[number]["id"];

export function Dashboard() {
  const [nav, setNav] = useState<NavId>("stats");
  const [navOpen, setNavOpen] = useState(false);
  const [rows, setRows] = useState<BillRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [month, setMonth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [openCurrencies, setOpenCurrencies] = useState<string[]>([]);
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const months = useMemo(() => (rows ? listMonths(rows) : []), [rows]);
  const activeMonth = months.includes(month) ? month : (months.at(-1) ?? "");
  const breakdown = useMemo(
    () => (rows && activeMonth ? summarizeMonth(rows, activeMonth) : []),
    [rows, activeMonth],
  );
  const cardRates = useMemo(
    () => (rows && activeMonth ? summarizeCreditCards(rows, activeMonth) : []),
    [rows, activeMonth],
  );
  const monthCount = rows && activeMonth ? countMonth(rows, activeMonth) : 0;
  const monthIndex = months.indexOf(activeMonth);
  const currentNav = NAV.find((item) => item.id === nav) ?? NAV[0];

  async function loadFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const nextRows = await parseBillFile(file);
      const nextMonths = listMonths(nextRows);
      setRows(nextRows);
      setFileName(file.name);
      setMonth(nextMonths.at(-1) ?? "");
      setOpenCurrencies([]);
      setNav("stats");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取这个文件");
    } finally {
      setLoading(false);
    }
  }

  function openFilePicker() {
    fileInput.current?.click();
  }

  function selectMonth(nextMonth: string) {
    setMonth(nextMonth);
    setOpenCurrencies([]);
  }

  function clearBill() {
    setRows(null);
    setFileName("");
    setMonth("");
    setOpenCurrencies([]);
    setError(null);
  }

  return (
    <div
      className="flex h-full bg-white text-[#171717]"
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void loadFile(file);
      }}
    >
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void loadFile(file);
        }}
      />

      {navOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          aria-label="关闭菜单"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-[#ebebeb] bg-white transition-transform md:static md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-[#ebebeb] px-4">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-black text-[11px] font-semibold text-white">
            A
          </span>
          <span className="text-sm font-semibold tracking-tight">Analyze</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-0.5">
            {NAV.map((item) => {
              const active = item.id === nav;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${
                    active
                      ? "bg-[#f2f2f2] font-medium text-black"
                      : "text-[#444] hover:bg-[#fafafa]"
                  }`}
                  onClick={() => {
                    setNav(item.id);
                    setNavOpen(false);
                  }}
                >
                  {item.id === "stats" ? <StatsIcon /> : <SettingsIcon />}
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
        <div className="border-t border-[#ebebeb] px-4 py-3">
          <p className="truncate text-xs text-[#888]">{fileName || "还没有导入账单"}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 flex-nowrap items-center gap-2 overflow-hidden border-b border-[#ebebeb] bg-white px-3 md:gap-3 md:px-6">
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#ebebeb] md:hidden"
            aria-label="打开菜单"
            onClick={() => setNavOpen(true)}
          >
            <MenuIcon />
          </button>
          <h1 className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-medium">
            {currentNav.label}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {nav === "stats" && months.length > 0 ? (
              <div className="flex h-8 shrink-0 items-center rounded-md border border-[#ebebeb] bg-white">
                <button
                  type="button"
                  className="grid h-8 w-7 shrink-0 place-items-center text-[#444] hover:bg-[#fafafa] disabled:cursor-default disabled:text-[#ccc] disabled:hover:bg-transparent"
                  aria-label="上个月"
                  disabled={monthIndex <= 0}
                  onClick={() => selectMonth(months[monthIndex - 1] ?? activeMonth)}
                >
                  <Chevron direction="left" />
                </button>
                <label className="sr-only" htmlFor="month">
                  月份
                </label>
                <select
                  id="month"
                  className="h-8 w-[6.25rem] shrink-0 appearance-none bg-transparent text-center text-sm font-medium whitespace-nowrap outline-none"
                  value={activeMonth}
                  onChange={(event) => selectMonth(event.target.value)}
                >
                  {months.map((item) => (
                    <option key={item} value={item}>
                      {formatMonth(item)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="grid h-8 w-7 shrink-0 place-items-center text-[#444] hover:bg-[#fafafa] disabled:cursor-default disabled:text-[#ccc] disabled:hover:bg-transparent"
                  aria-label="下个月"
                  disabled={monthIndex < 0 || monthIndex >= months.length - 1}
                  onClick={() => selectMonth(months[monthIndex + 1] ?? activeMonth)}
                >
                  <Chevron direction="right" />
                </button>
              </div>
            ) : null}
            {rows ? (
              <button
                type="button"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#ebebeb] text-sm whitespace-nowrap hover:bg-[#fafafa] sm:w-auto sm:px-3"
                aria-label="更换文件"
                onClick={openFilePicker}
              >
                <ReplaceIcon />
                <span className="hidden sm:inline">更换文件</span>
              </button>
            ) : null}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-[#fafafa]">
          {error ? (
            <p className="border-b border-[#f5c2c2] bg-[#fff5f5] px-4 py-2 text-sm text-[#b42318] md:px-6">
              {error}
            </p>
          ) : null}

          {nav === "settings" ? (
            <SettingsView
              fileName={fileName}
              loading={loading}
              onBrowse={openFilePicker}
              onClear={clearBill}
            />
          ) : !rows ? (
            <DropZone loading={loading} onBrowse={openFilePicker} />
          ) : (
            <section className="mx-auto max-w-5xl px-4 py-8 md:px-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {formatMonth(activeMonth)}
                </h2>
                <p className="mt-1 text-sm text-[#666]">{monthCount} 笔交易</p>
              </div>
              <article className="rounded-lg border border-[#ebebeb] bg-white">
                <div className="border-b border-[#ebebeb] px-5 py-4">
                  <h3 className="text-sm font-medium">优惠</h3>
                  <p className="mt-1 text-sm text-[#666]">
                    优惠列（不含付费卡券）+ 意外收入 − 付费卡券花费
                  </p>
                </div>
                {breakdown.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-[#666]">这个月没有记录</p>
                ) : (
                  <ul>
                    {breakdown.map((item) => {
                      const open = openCurrencies.includes(item.currency);
                      const lines =
                        rows && activeMonth
                          ? discountLines(rows, activeMonth, item.currency)
                          : [];
                      return (
                        <li key={item.currency} className="border-b border-[#f2f2f2] last:border-0">
                          <button
                            type="button"
                            className="w-full px-5 py-4 text-left hover:bg-[#fafafa]"
                            aria-expanded={open}
                            onClick={() =>
                              setOpenCurrencies((current) =>
                                current.includes(item.currency)
                                  ? current.filter((currency) => currency !== item.currency)
                                  : [...current, item.currency],
                              )
                            }
                          >
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="flex items-center gap-2 text-sm font-medium">
                                <span className={`text-[#888] ${open ? "rotate-90" : ""}`}>
                                  <Chevron direction="right" />
                                </span>
                                {item.currency}
                              </span>
                              <span className="text-2xl font-semibold tracking-tight tabular-nums">
                                {formatCents(totalCents(item))}
                              </span>
                            </div>
                            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <dt className="text-xs text-[#888]">优惠</dt>
                                <dd className="mt-1 tabular-nums">{formatCents(item.discountCents)}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-[#888]">意外收入</dt>
                                <dd className="mt-1 tabular-nums">{formatCents(item.windfallCents)}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-[#888]">付费卡券</dt>
                                <dd className="mt-1 tabular-nums">{formatCents(item.couponCents)}</dd>
                              </div>
                            </dl>
                          </button>
                          {open ? (
                            lines.length === 0 ? (
                              <p className="border-t border-[#f2f2f2] px-5 py-4 text-sm text-[#666]">
                                这个月没有可列出的交易
                              </p>
                            ) : (
                              <ul className="border-t border-[#f2f2f2] bg-[#fafafa]">
                                {lines.map((line, index) => (
                                  <li
                                    key={`${line.date}-${line.kind}-${index}`}
                                    className="flex items-start justify-between gap-4 border-b border-[#f2f2f2] px-5 py-3 last:border-0"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm">
                                        {formatTxnDate(line.date)}
                                        <span className="text-[#888]">
                                          {" "}
                                          · {lineLabel(line)}
                                        </span>
                                      </p>
                                      {line.remark || line.account ? (
                                        <p className="mt-1 truncate text-xs text-[#888]">
                                          {[line.remark, line.account].filter(Boolean).join(" · ")}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <p className="text-sm font-medium tabular-nums">
                                        {formatCents(line.sortCents)}
                                      </p>
                                      <p className="mt-1 text-xs text-[#888]">
                                        {line.kind === "windfall" ? "金额" : "优惠"}
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
              <article className="mt-4 rounded-lg border border-[#ebebeb] bg-white">
                <div className="border-b border-[#ebebeb] px-5 py-4">
                  <h3 className="text-sm font-medium">信用卡优惠率</h3>
                  <p className="mt-1 text-sm text-[#666]">
                    （支出优惠 + 意外收入 + 还款优惠）/ 支出金额，次行是还款优惠 / 支出金额
                  </p>
                </div>
                {cardRates.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-[#666]">这个月没有信用卡支出</p>
                ) : (
                  <ul>
                    {cardRates.map((card) => (
                      <li key={card.account} className="border-b border-[#f2f2f2] px-5 py-4 last:border-0">
                        <p className="text-sm font-medium">{card.account}</p>
                        <div className="mt-3 space-y-4">
                          {card.currencies.map((item) => {
                            const combined =
                              item.expenseDiscountCents +
                              item.windfallCents +
                              item.repaymentDiscountCents;
                            return (
                              <div key={item.currency}>
                                <div className="flex items-baseline justify-between gap-4">
                                  <span className="text-sm text-[#444]">{item.currency}</span>
                                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                                    {formatRate(combined, item.spendCents)}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-baseline justify-between gap-4 text-sm text-[#666]">
                                  <span>还款优惠率</span>
                                  <span className="tabular-nums">
                                    {formatRate(item.repaymentDiscountCents, item.spendCents)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </section>
          )}
        </main>
      </div>

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-white/80 p-6">
          <div className="rounded-xl border border-dashed border-black bg-white px-8 py-6 text-sm font-medium">
            松开以导入账单
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DropZone({ loading, onBrowse }: { loading: boolean; onBrowse: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <button
        type="button"
        onClick={onBrowse}
        className="flex w-full max-w-lg flex-col items-center rounded-xl border border-dashed border-[#ccc] bg-white px-8 py-16 text-center hover:border-[#999]"
      >
        <span className="text-sm font-medium">
          {loading ? "正在读取…" : "把账单拖到页面上"}
        </span>
        <span className="mt-2 text-sm text-[#666]">也可以点击这里选择 xlsx 或 csv</span>
      </button>
    </div>
  );
}

function SettingsView({
  fileName,
  loading,
  onBrowse,
  onClear,
}: {
  fileName: string;
  loading: boolean;
  onBrowse: () => void;
  onClear: () => void;
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <h2 className="text-2xl font-semibold tracking-tight">设置</h2>
      <div className="mt-6 overflow-hidden rounded-lg border border-[#ebebeb] bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-[#f2f2f2] px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">当前账单</p>
            <p className="mt-1 truncate text-sm text-[#666]">
              {fileName || "还没有导入"}
            </p>
          </div>
          <button
            type="button"
            className="h-8 shrink-0 rounded-md border border-[#ebebeb] px-3 text-sm hover:bg-[#fafafa]"
            onClick={onBrowse}
          >
            {loading ? "正在读取…" : fileName ? "更换文件" : "选择文件"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-medium">清除数据</p>
            <p className="mt-1 text-sm text-[#666]">移除已导入的账单，文件本身不会被删除</p>
          </div>
          <button
            type="button"
            className="h-8 shrink-0 rounded-md border border-[#ebebeb] px-3 text-sm hover:bg-[#fafafa] disabled:cursor-default disabled:text-[#ccc] disabled:hover:bg-transparent"
            disabled={!fileName || loading}
            onClick={onClear}
          >
            清除
          </button>
        </div>
      </div>
    </section>
  );
}

function StatsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 13.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M4.25 13.5V8.25M8 13.5V3.75M11.75 13.5V6.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.25H4.25M7.75 4.25H13.5M2.5 11.75H8.75M12.25 11.75H13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="6" cy="4.25" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10.5" cy="11.75" r="1.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function lineLabel(line: { kind: string; category: string }): string {
  if (line.kind === "windfall") return "意外收入";
  if (line.kind === "transfer") return "转账";
  if (line.kind === "repayment") return "还款";
  return line.category || "支出";
}

function formatTxnDate(date: string): string {
  const match = date.trim().match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})(?:\s+(\d{1,2}:\d{2}))?/);
  if (!match) return date;
  const day = `${Number(match[2])}/${Number(match[3])}`;
  return match[4] ? `${day} ${match[4]}` : day;
}

function ReplaceIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="sm:hidden"
    >
      <path
        d="M3 8.5h7.5M8.5 5.5 11.5 8.5 8.5 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 4.5v7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={direction === "left" ? "M10 3.5 5.5 8 10 12.5" : "M6 3.5 10.5 8 6 12.5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
