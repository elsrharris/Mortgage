document.addEventListener("DOMContentLoaded", async () => {
  const SUPABASE_URL = "https://spraufetfcpwajuqrwyr.supabase.co";
  const SUPABASE_KEY = "sb_publishable_3mlUdheuqY6ycpX3InNQGw_iM1f4R-Y";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const form = document.getElementById("settings-form");
  const recalcBtn = document.getElementById("recalc-btn");

  const principalEl = document.getElementById("principal");
  const startDateEl = document.getElementById("start_date");
  const termYearsEl = document.getElementById("term_years");
  const annualRateEl = document.getElementById("annual_rate");
  const monthlyPaymentEl = document.getElementById("monthly_payment");

  const paidSoFarEl = document.getElementById("paid_so_far");
  const balanceLeftEl = document.getElementById("balance_left");
  const monthsLeftEl = document.getElementById("months_left");
  const paymentUsedEl = document.getElementById("payment_used");
  const calcNoteEl = document.getElementById("calc_note");

  let settingsRow = null;
  let payments = [];

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
    // Keep it yyyy-mm-dd
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
    // monthIndex 0 = start month
    const monthStart = new Date(addMonths(startDate, monthIndex));
    const monthEnd = new Date(addMonths(startDate, monthIndex + 1));

    let sum = 0;
    for (const p of payments) {
      // treat only repayment + overpayment as reducing principal
      if (p.type !== "repayment" && p.type !== "overpayment") continue;
      const pd = new Date(p.date);
      if (pd >= monthStart && pd < monthEnd) sum += Number(p.amount);
    }
    return sum;
  }

  function calculateProgress({ principal, start_date, term_years, annual_rate, monthly_payment }) {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const r = (annual_rate / 100) / 12;
    const n = term_years * 12;

    const paymentUsed = monthly_payment && Number(monthly_payment) > 0
      ? Number(monthly_payment)
      : calcMonthlyPayment(Number(principal), Number(annual_rate), Number(term_years));

    const monthsSoFar = Math.max(0, Math.min(n, monthsBetween(start_date, todayStr)));

    let balance = Number(principal);

    // Apply amortisation month-by-month from start to now.
    for (let m = 0; m < monthsSoFar; m++) {
      // interest
      if (r > 0) balance = balance * (1 + r);

      // actual payments made in that month (repay + overpay)
      const actualPaid = sumPaymentsInMonth(payments, start_date, m);

      // If they didn’t log monthly repayments, you can still track overpayments,
      // but balance will look high. We assume actualPaid is what reduced principal.
      balance = balance - actualPaid;

      if (balance <= 0) {
        balance = 0;
        break;
      }
    }

    // Paid so far (repay + overpay)
    const paidSoFar = payments
      .filter(p => p.type === "repayment" || p.type === "overpayment")
      .reduce((acc, p) => acc + Number(p.amount), 0);

    // Estimate months left from *current* balance at same paymentUsed (minimum: interest+principal)
    let monthsLeft = 0;
    if (balance > 0) {
      let simBal = balance;
      for (let m = 0; m < 1200; m++) { // hard cap 100 years
        if (r > 0) simBal = simBal * (1 + r);
        simBal = simBal - paymentUsed;
        monthsLeft++;
        if (simBal <= 0) break;
        // If payment doesn’t cover interest, this would never finish:
        if (paymentUsed <= simBal * r && r > 0 && m > 12) break;
      }
    }

    // Notes to set expectations
    let note = "Estimate assumes monthly compounding and that your logged repayments/overpayments reflect what was paid to the lender each month.";
    if (monthsSoFar === 0) note = "Enter a start date in the past to see progress.";
    if (paidSoFar === 0) note = "You haven’t logged any repayments/overpayments yet — add them on the Payments page for accurate balance tracking.";

    return { paidSoFar, balance, monthsLeft, paymentUsed, note };
  }

  async function loadPayments() {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      console.error("Error loading payments:", error);
      payments = [];
      return;
    }
    payments = data || [];
  }

  async function loadSettings() {
    // take the most recently updated row (or none)
    const { data, error } = await supabase
      .from("mortgage_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error loading mortgage settings:", error);
      settingsRow = null;
      return;
    }

    settingsRow = (data && data[0]) ? data[0] : null;

    if (settingsRow) {
      principalEl.value = settingsRow.principal ?? "";
      startDateEl.value = settingsRow.start_date ?? "";
      termYearsEl.value = settingsRow.term_years ?? "";
      annualRateEl.value = settingsRow.annual_rate ?? "";
      monthlyPaymentEl.value = settingsRow.monthly_payment ?? "";
    }
  }

  function recalcFromForm() {
    const principal = Number(principalEl.value);
    const start_date = startDateEl.value;
    const term_years = Number(termYearsEl.value);
    const annual_rate = Number(annualRateEl.value);
    const monthly_payment = monthlyPaymentEl.value ? Number(monthlyPaymentEl.value) : null;

    if (!principal || !start_date || !term_years || annual_rate === null || Number.isNaN(annual_rate)) {
      calcNoteEl.textContent = "Fill in principal, start date, term years, and interest rate.";
      return;
    }

    const { paidSoFar, balance, monthsLeft, paymentUsed, note } = calculateProgress({
      principal,
      start_date,
      term_years,
      annual_rate,
      monthly_payment
    });

    paidSoFarEl.textContent = toMoney(paidSoFar);
    balanceLeftEl.textContent = toMoney(balance);
    monthsLeftEl.textContent = String(monthsLeft);
    paymentUsedEl.textContent = toMoney(paymentUsed);
    calcNoteEl.textContent = note;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const principal = Number(principalEl.value);
    const start_date = startDateEl.value;
    const term_years = Number(termYearsEl.value);
    const annual_rate = Number(annualRateEl.value);
    const monthly_payment = monthlyPaymentEl.value ? Number(monthlyPaymentEl.value) : null;

    if (!principal || !start_date || !term_years || Number.isNaN(annual_rate)) return;

    // If there’s an existing row, update it; otherwise insert.
    if (settingsRow?.id) {
      const { error } = await supabase
        .from("mortgage_settings")
        .update({
          principal,
          start_date,
          term_years,
          annual_rate,
          monthly_payment,
          updated_at: new Date().toISOString()
        })
        .eq("id", settingsRow.id);

      if (error) console.error("Error updating settings:", error);
    } else {
      const { data, error } = await supabase
        .from("mortgage_settings")
        .insert([{
          principal,
          start_date,
          term_years,
          annual_rate,
          monthly_payment,
          updated_at: new Date().toISOString()
        }])
        .select("*")
        .single();

      if (error) console.error("Error inserting settings:", error);
      settingsRow = data || settingsRow;
    }

    recalcFromForm();
  });

  recalcBtn.addEventListener("click", () => {
    recalcFromForm();
  });

  await loadPayments();
  await loadSettings();
  recalcFromForm();

    // Recalculate whenever the page/tab regains focus
  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
      await loadPayments();
      recalcFromForm();
    }
  });

  window.addEventListener("focus", async () => {
  await loadPayments();
  recalcFromForm();
});



});
