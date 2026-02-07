document.addEventListener("DOMContentLoaded", async () => {
  const SUPABASE_URL = "https://spraufetfcpwajuqrwyr.supabase.co";
  const SUPABASE_KEY = "sb_publishable_3mlUdheuqY6ycpX3InNQGw_iM1f4R-Y";

  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  const form = document.getElementById("payment-form");
  const paymentList = document.getElementById("payment-list");
  const totalEEl = document.getElementById("totalE");
  const totalZEl = document.getElementById("totalZ");
  const ownershipEl = document.getElementById("ownership");

  async function loadPayments() {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    renderPayments(data);
  }

  function renderPayments(payments) {
    paymentList.innerHTML = "";
    let totalE = 0;
    let totalZ = 0;

    payments.forEach((p) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${p.date}</td>
        <td>${p.person}</td>
        <td>${p.type}</td>
        <td>£${Number(p.amount).toFixed(2)}</td>
        <td>
          <button class="delete-btn" data-id="${p.id}">✖</button>
        </td>
      `;
      paymentList.appendChild(row);

      if (p.person === "E") totalE += Number(p.amount);
      if (p.person === "Z") totalZ += Number(p.amount);
    });

    totalEEl.textContent = totalE.toFixed(2);
    totalZEl.textContent = totalZ.toFixed(2);

    const total = totalE + totalZ;
    ownershipEl.textContent =
      total > 0
        ? `${((totalE / total) * 100).toFixed(1)}% / ${((totalZ / total) * 100).toFixed(1)}%`
        : "50% / 50%";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const person = document.getElementById("person").value;
    const type = document.getElementById("type").value;
    const amount = document.getElementById("amount").value;
    const date =
      document.getElementById("date").value ||
      new Date().toISOString().split("T")[0];

    if (!person || !type || !amount) return;

    await supabase.from("payments").insert([
      {
        person,
        type,
        amount: parseFloat(amount),
        date
      }
    ]);

    form.reset();
    loadPayments();
  });

  paymentList.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("delete-btn")) return;

    const id = e.target.dataset.id;
    await supabase.from("payments").delete().eq("id", id);
    loadPayments();
  });

  loadPayments();
});
