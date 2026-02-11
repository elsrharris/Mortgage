document.addEventListener("DOMContentLoaded", async () => {
  const SUPABASE_URL = "https://spraufetfcpwajuqrwyr.supabase.co";
  const SUPABASE_KEY = "sb_publishable_3mlUdheuqY6ycpX3InNQGw_iM1f4R-Y";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const propertyValueEl = document.getElementById("property_value");
  const mortgageBalanceEl = document.getElementById("mortgage_balance");
  const totalEquityEl = document.getElementById("total_equity");
  const ltvEl = document.getElementById("ltv");
  const noteEl = document.getElementById("equity_note");

  const form = document.getElementById("equity-form");
  const valuationDateEl = document.getElementById("valuation_date");
  const propertyValueInput = document.getElementById("propertyValue");
  const equityList = document.getElementById("equity-list");

  function toMoney(n) {
    return Number(n || 0).toFixed(2);
  }

  function monthsBetween(startDate, endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  }

  function addMonths(dateStr, months) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function calcMonthlyPayment(P, annualRatePct, termYears) {
    const r = (annualRatePct / 100) / 12;
    const n = termYears * 12;
    if (r === 0) return P / n;
    const pow = Math.pow(1 + r, n);
    return P * (r * pow) / (pow - 1);
  }

  function sumPaymentsInMonth(payments, startDate, monthIndex) {
    const monthStart = new Date(addMonths(startDate, monthIndex));
    const monthEnd = new Date(addMonths(startDate, monthIndex + 1));

    let sum = 0;
    for (const p of payments) {
      if (p.type !== "repayment" && p.type !== "overpayment") continue;
      const pd = new Date(p.date);
      if (pd >= monthStart && pd < monthEnd) sum += Number(p.amount);
    }
    return sum;
  }

  function estimateBalance(settings, payments) {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const principal = Number(settings.principal);
    const annualRate = Number(settings.annual_rate);
    const termYears = Number(settings.term_years);

    const r = (annualRate / 100) / 12;
    const n = termYears * 12;

    const paymentUsed =
      settings.monthly_payment && Number(settings.monthly_payment) > 0
        ? Number(settings.monthly_payment)
        : calcMonthlyPayment(principal, annualRate, termYears);

    const monthsSoFar = Math.max(0, Math.min(n, monthsBetween(settings.start_date, todayStr)));

    let balance = principal;

    for (let m = 0; m < monthsSoFar; m++) {
      if (r > 0) balance = balance * (1 + r);
      const actualPaid = sumPaymentsInMonth(payments, settings.start_date, m);
      balance = balance - actualPaid;
      if (balance <= 0) {
        balance = 0;
        break;
      }
    }

    return { balance, paymentUsed, monthsSoFar };
  }

  async function loadLatestSettings() {
    const { data, error } = await supabase
      .from("mortgage_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0] ?? null;
  }

  async function loadPayments() {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("date", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function loadValuations() {
    const { data, error } = await supabase
      .from("equity_snapshots")
      .select("*")
      .order("valuation_date", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  function renderValuationHistory(rows) {
    equityList.innerHTML = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.valuation_date ?? ""}</td>
        <td>£${toMoney(r.property_value)}</td>
      `;
      equityList.appendChild(tr);
    });
  }

  function setSummary({ propertyValue, mortgageBalance }) {
    propertyValueEl.textContent = toMoney(propertyValue);
    mortgageBalanceEl.textContent = toMoney(mortgageBalance);

    const equity = Math.max(0, Number(propertyValue) - Number(mortgageBalance));
    totalEquityEl.textContent = toMoney(equity);

    const ltv = propertyValue > 0 ? (mortgageBalance / propertyValue) * 100 : 0;
    ltvEl.textContent = ltv.toFixed(1);
  }

  async function refresh() {
    try {
      const [settings, payments, valuations] = await Promise.all([
        loadLatestSettings(),
        loadPayments(),
        loadValuations(),
      ]);

      renderValuationHistory(valuations);

      const latestValuation = valuations?.[0] ?? null;
      const propertyValue = latestValuation ? Number(latestValuation.property_value) : 0;

      if (!settings) {
        noteEl.textContent = "No mortgage settings found yet — set them on the Mortgage tab.";
        setSummary({ propertyValue, mortgageBalance: 0 });
        return;
      }

      const { balance } = estimateBalance(settings, payments);

      if (!latestValuation) {
        noteEl.textContent =
          "No property valuation saved yet — add one below to calculate equity and LTV.";
      } else {
        noteEl.textContent =
          "Mortgage balance is an estimate based on your logged repayments/overpayments and your saved mortgage settings.";
      }

      setSummary({ propertyValue, mortgageBalance: balance });
    } catch (err) {
      console.error("Equity refresh error:", err);
      noteEl.textContent = "Error loading equity data — check console for details.";
    }
  }

  // Default valuation date = today
  valuationDateEl.value = new Date().toISOString().split("T")[0];

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const valuation_date =
      valuationDateEl.value || new Date().toISOString().split("T")[0];
    const property_value = Number(propertyValueInput.value);

    if (!property_value || property_value <= 0) return;

    const { error } = await supabase
      .from("equity_snapshots")
      .insert([{ valuation_date, property_value }]);

    if (error) {
      console.error("Error saving valuation:", error);
      return;
    }

    form.reset();
    valuationDateEl.value = new Date().toISOString().split("T")[0];

    await refresh();
  });

  // Refresh when returning to the tab
  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) await refresh();
  });

  window.addEventListener("focus", async () => {
    await refresh();
  });

  await refresh();
});
