// script.js
document.addEventListener("DOMContentLoaded", async () => {
  const SUPABASE_URL = "https://spraufetfcpwajuqrwyr.supabase.co";
  const SUPABASE_KEY = "sb_publishable_3mlUdheuqY6ycpX3InNQGw_iM1f4R-Y";

  // Guard: make sure Supabase loaded
  if (!window.supabase?.createClient) {
    console.error("Supabase client library not loaded. Check the <script src=...supabase-js@2> tag.");
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const form = document.getElementById("payment-form");
  const paymentList = document.getElementById("payment-list");
  const totalEEl = document.getElementById("totalE");
  const totalZEl = document.getElementById("totalZ");
  const ownershipEl = document.getElementById("ownership");

  // Pie chart elements (requires Chart.js loaded in index.html)
  const chartCanvas = document.getElementById("ownershipChart");
  const chartCard = document.getElementById("chartCard");
  let ownershipChart = null;

  // Delete confirmation modal elements
  const confirmModal = document.getElementById("confirmModal");
  const cancelDeleteBtn = document.getElementById("cancelDelete");
  const confirmDeleteBtn = document.getElementById("confirmDelete");

  // Guard: modal elements exist
  if (!confirmModal || !cancelDeleteBtn || !confirmDeleteBtn) {
    console.error("Modal elements not found", { confirmModal, cancelDeleteBtn, confirmDeleteBtn });
  }

  let pendingDeleteId = null;

  function openDeleteModal(id) {
    console.log("Opening delete modal for id:", id);
    pendingDeleteId = id;
    confirmModal.classList.remove("hidden");
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    confirmModal.classList.add("hidden");
  }

  // Expand chart on click (adds/removes .expanded class from CSS)
  if (chartCard) {
    chartCard.addEventListener("click", () => {
      chartCard.classList.toggle("expanded");
    });
  }

  async function loadPayments() {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      console.error("Error loading payments:", error);
      return;
    }

    renderPayments(data || []);
  }

  function renderPayments(payments) {
    paymentList.innerHTML = "";

    let totalE = 0;
    let totalZ = 0;

    payments.forEach((p) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${p.date ?? ""}</td>
        <td>${p.person ?? ""}</td>
        <td>${p.type ?? ""}</td>
        <td>£${Number(p.amount || 0).toFixed(2)}</td>
        <td><button class="delete-btn" data-id="${p.id}" type="button">✖</button></td>
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

    // ---- Pie chart (E vs Z) ----
    const chartDataE = total > 0 ? totalE : 1;
    const chartDataZ = total > 0 ? totalZ : 1;

    if (!window.Chart || !chartCanvas) return;

    if (!ownershipChart) {
      ownershipChart = new Chart(chartCanvas, {
        type: "pie",
        data: {
          labels: ["E", "Z"],
          datasets: [
            {
              data: [chartDataE, chartDataZ],
              backgroundColor: ["#4e8cff", "#ff5aa5"], // E blue, Z pink
              borderColor: "#1e1e1e",
              borderWidth: 2,
              hoverOffset: 10,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: "#e0e0e0" },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const value = Number(ctx.raw || 0);
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "50.0";
                  const pounds = total > 0 ? `£${value.toFixed(2)}` : "";
                  return `${ctx.label}: ${pounds} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    } else {
      ownershipChart.data.datasets[0].data = [chartDataE, chartDataZ];
      ownershipChart.update();
    }
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

    const { error } = await supabase.from("payments").insert([
      {
        person,
        type,
        amount: parseFloat(amount),
        date,
      },
    ]);

    if (error) {
      console.error("Error adding payment:", error);
      return;
    }

    form.reset();
    // Ensure repayment is default after reset
    document.getElementById("type").value = "repayment";

    loadPayments();
  });

  // ✅ Click delete button -> open confirmation modal (robust)
  paymentList.addEventListener("click", (e) => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;

    const id = btn.dataset.id; // keep as string (works for uuid or numeric)
    openDeleteModal(id);
  });

  // Modal button handlers
  cancelDeleteBtn.addEventListener("click", () => {
    closeDeleteModal();
  });

  confirmDeleteBtn.addEventListener("click", async () => {
    if (!pendingDeleteId) return;

    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", pendingDeleteId);

    if (error) {
      console.error("Error deleting payment:", error);
    }

    closeDeleteModal();
    loadPayments();
  });

  // Close modal if clicking overlay
  confirmModal.addEventListener("click", (e) => {
    if (e.target === confirmModal) closeDeleteModal();
  });

  // Close modal with ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !confirmModal.classList.contains("hidden")) {
      closeDeleteModal();
    }
  });

  loadPayments();
});
