document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("payment-form");
  const paymentList = document.getElementById("payment-list");
  const totalEEl = document.getElementById("totalE");
  const totalZEl = document.getElementById("totalZ");
  const ownershipEl = document.getElementById("ownership");

  let payments = JSON.parse(localStorage.getItem("payments")) || [];

  function renderPayments() {
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
      `;
      paymentList.appendChild(row);

      if (p.person === "E") totalE += Number(p.amount);
      else if (p.person === "Z") totalZ += Number(p.amount);
    });

    totalEEl.textContent = totalE.toFixed(2);
    totalZEl.textContent = totalZ.toFixed(2);

    const total = totalE + totalZ;
    if (total > 0) {
      const eShare = ((totalE / total) * 100).toFixed(1);
      const zShare = ((totalZ / total) * 100).toFixed(1);
      ownershipEl.textContent = `${eShare}% / ${zShare}%`;
    } else {
      ownershipEl.textContent = "50% / 50%";
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const person = document.getElementById("person").value;
    const type = document.getElementById("type").value;
    const amount = document.getElementById("amount").value;
    const dateField = document.getElementById("date");
    const date = dateField.value || new Date().toISOString().split("T")[0];

    if (!person || !type || !amount) return;

    const payment = { person, type, amount: parseFloat(amount), date };
    payments.push(payment);

    localStorage.setItem("payments", JSON.stringify(payments));
    renderPayments();
    form.reset();
  });

  renderPayments();
});
