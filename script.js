const STORAGE_KEY = "personalFinanceTracker.transactions";
const BUDGET_KEY = "personalFinanceTracker.monthlyBudget";

const colors = ["#1f6feb", "#e14d43", "#159957", "#d99a20", "#7157d9", "#0c9aa7", "#d94f9f", "#64748b"];

const state = {
  transactions: JSON.parse(localStorage.getItem(STORAGE_KEY)) || [],
  budget: Number(localStorage.getItem(BUDGET_KEY)) || 0,
  filterType: "all",
  search: ""
};

const $ = (selector) => document.querySelector(selector);
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

const elements = {
  form: $("#transactionForm"),
  type: $("#type"),
  category: $("#category"),
  amount: $("#amount"),
  date: $("#date"),
  note: $("#note"),
  reportMonth: $("#reportMonth"),
  totalIncome: $("#totalIncome"),
  totalExpense: $("#totalExpense"),
  balance: $("#balance"),
  budgetLeft: $("#budgetLeft"),
  budgetForm: $("#budgetForm"),
  monthlyBudget: $("#monthlyBudget"),
  budgetProgress: $("#budgetProgress"),
  budgetText: $("#budgetText"),
  budgetStatus: $("#budgetStatus"),
  insightText: $("#insightText"),
  table: $("#transactionTable"),
  emptyState: $("#emptyState"),
  filterType: $("#filterType"),
  searchInput: $("#searchInput"),
  chart: $("#expenseChart"),
  chartLegend: $("#chartLegend"),
  chartTotal: $("#chartTotal"),
  reportCount: $("#reportCount"),
  topExpense: $("#topExpense"),
  savingsRate: $("#savingsRate"),
  dailyAverage: $("#dailyAverage"),
  clearAllBtn: $("#clearAllBtn"),
  exportBtn: $("#exportBtn")
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthISO(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
}

function saveBudget() {
  localStorage.setItem(BUDGET_KEY, String(state.budget));
}

function selectedMonthTransactions() {
  return state.transactions.filter((item) => item.date.startsWith(elements.reportMonth.value));
}

function filteredTransactions() {
  const query = state.search.trim().toLowerCase();
  return selectedMonthTransactions()
    .filter((item) => state.filterType === "all" || item.type === state.filterType)
    .filter((item) => {
      if (!query) return true;
      return item.category.toLowerCase().includes(query) || item.note.toLowerCase().includes(query);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function totals(items) {
  return items.reduce(
    (sum, item) => {
      sum[item.type] += item.amount;
      return sum;
    },
    { income: 0, expense: 0 }
  );
}

function byExpenseCategory(items) {
  return items
    .filter((item) => item.type === "expense")
    .reduce((groups, item) => {
      groups[item.category] = (groups[item.category] || 0) + item.amount;
      return groups;
    }, {});
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderSummary(items) {
  const sum = totals(items);
  const balance = sum.income - sum.expense;
  const budgetLeft = state.budget - sum.expense;

  elements.totalIncome.textContent = currency.format(sum.income);
  elements.totalExpense.textContent = currency.format(sum.expense);
  elements.balance.textContent = currency.format(balance);
  elements.budgetLeft.textContent = state.budget ? currency.format(budgetLeft) : currency.format(0);
  elements.balance.style.color = balance >= 0 ? "var(--income)" : "var(--expense)";
  elements.budgetLeft.style.color = budgetLeft >= 0 ? "var(--income)" : "var(--expense)";
}

function renderBudget(items) {
  const spent = totals(items).expense;
  const percent = state.budget ? Math.min((spent / state.budget) * 100, 100) : 0;
  const remaining = state.budget - spent;

  elements.monthlyBudget.value = state.budget || "";
  elements.budgetProgress.style.width = `${percent}%`;
  elements.budgetProgress.style.background = percent >= 100 ? "var(--expense)" : percent >= 80 ? "var(--gold)" : "var(--income)";

  elements.budgetStatus.className = "status-pill";
  if (!state.budget) {
    elements.budgetStatus.textContent = "No budget";
    elements.budgetText.textContent = "Set a monthly budget to track spending.";
  } else if (remaining < 0) {
    elements.budgetStatus.textContent = "Over budget";
    elements.budgetStatus.classList.add("danger");
    elements.budgetText.textContent = `${currency.format(Math.abs(remaining))} over your ${currency.format(state.budget)} monthly budget.`;
  } else if (percent >= 80) {
    elements.budgetStatus.textContent = "Watch spend";
    elements.budgetStatus.classList.add("warning");
    elements.budgetText.textContent = `${currency.format(remaining)} left from your ${currency.format(state.budget)} monthly budget.`;
  } else {
    elements.budgetStatus.textContent = "On track";
    elements.budgetText.textContent = `${currency.format(remaining)} left from your ${currency.format(state.budget)} monthly budget.`;
  }
}

function renderInsight(items) {
  const sum = totals(items);
  const balance = sum.income - sum.expense;
  const expenseGroups = byExpenseCategory(items);
  const top = Object.entries(expenseGroups).sort((a, b) => b[1] - a[1])[0];

  if (!items.length) {
    elements.insightText.textContent = "Add transactions to see your money pattern.";
    return;
  }

  if (!sum.expense) {
    elements.insightText.textContent = `Great start. You recorded ${currency.format(sum.income)} income and no expenses this month.`;
    return;
  }

  if (state.budget && sum.expense > state.budget) {
    elements.insightText.textContent = `You crossed your budget by ${currency.format(sum.expense - state.budget)}. Biggest spend: ${top[0]}.`;
    return;
  }

  if (balance > 0) {
    elements.insightText.textContent = `You are saving ${currency.format(balance)} this month. Biggest spend: ${top[0]}.`;
    return;
  }

  elements.insightText.textContent = `Expenses are higher than income by ${currency.format(Math.abs(balance))}. Biggest spend: ${top[0]}.`;
}

function drawPie(groups) {
  const ctx = elements.chart.getContext("2d");
  const size = elements.chart.width;
  const center = size / 2;
  const radius = center - 16;
  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, item) => sum + item[1], 0);

  ctx.clearRect(0, 0, size, size);
  elements.chartLegend.innerHTML = "";
  elements.chartTotal.textContent = `${currency.format(total)} spent`;

  if (!total) {
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#e8eeeb";
    ctx.fill();
    ctx.fillStyle = "#68746f";
    ctx.font = "700 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("No expenses", center, center + 5);
    elements.chartLegend.innerHTML = '<p class="muted">Add expenses to see category shares.</p>';
    return;
  }

  let start = -Math.PI / 2;
  entries.forEach(([category, amount], index) => {
    const angle = (amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
    start += angle;
  });

  entries.forEach(([category, amount], index) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    const percent = Math.round((amount / total) * 100);
    item.innerHTML = `
      <span class="legend-color" style="background:${colors[index % colors.length]}"></span>
      <span>${category}</span>
      <strong>${percent}%</strong>
    `;
    elements.chartLegend.appendChild(item);
  });
}

function renderReport(items) {
  const sum = totals(items);
  const expenseGroups = byExpenseCategory(items);
  const top = Object.entries(expenseGroups).sort((a, b) => b[1] - a[1])[0];
  const daysInMonth = new Date(`${elements.reportMonth.value}-01`);
  const days = new Date(daysInMonth.getFullYear(), daysInMonth.getMonth() + 1, 0).getDate();
  const savings = sum.income ? Math.round(((sum.income - sum.expense) / sum.income) * 100) : 0;

  elements.reportCount.textContent = String(items.length);
  elements.topExpense.textContent = top ? `${top[0]} (${currency.format(top[1])})` : "None";
  elements.savingsRate.textContent = `${savings}%`;
  elements.dailyAverage.textContent = currency.format(sum.expense / days);
}

function renderTable() {
  const rows = filteredTransactions();
  elements.table.innerHTML = "";
  elements.emptyState.style.display = rows.length ? "none" : "block";

  rows.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.date}</td>
      <td><span class="type-badge ${item.type}">${item.type}</span></td>
      <td>${item.category}</td>
      <td>${item.note || "-"}</td>
      <td class="amount">${item.type === "expense" ? "-" : "+"}${currency.format(item.amount)}</td>
      <td><button class="delete-btn" data-id="${item.id}" type="button">Delete</button></td>
    `;
    elements.table.appendChild(row);
  });
}

function render() {
  const monthItems = selectedMonthTransactions();
  renderSummary(monthItems);
  renderBudget(monthItems);
  renderInsight(monthItems);
  drawPie(byExpenseCategory(monthItems));
  renderReport(monthItems);
  renderTable();
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();

  const transaction = {
    id: createId(),
    type: elements.type.value,
    category: elements.category.value.trim(),
    amount: Number(elements.amount.value),
    date: elements.date.value,
    note: elements.note.value.trim()
  };

  if (!transaction.category || transaction.amount <= 0 || !transaction.date) return;

  state.transactions.push(transaction);
  saveTransactions();
  elements.form.reset();
  elements.date.value = todayISO();
  render();
});

elements.budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.budget = Number(elements.monthlyBudget.value) || 0;
  saveBudget();
  render();
});

elements.table.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-btn");
  if (!button) return;
  state.transactions = state.transactions.filter((item) => item.id !== button.dataset.id);
  saveTransactions();
  render();
});

elements.filterType.addEventListener("change", () => {
  state.filterType = elements.filterType.value;
  renderTable();
});

elements.searchInput.addEventListener("input", () => {
  state.search = elements.searchInput.value;
  renderTable();
});

elements.reportMonth.addEventListener("change", render);

elements.clearAllBtn.addEventListener("click", () => {
  if (!state.transactions.length) return;
  const confirmed = confirm("Delete all saved transactions?");
  if (!confirmed) return;
  state.transactions = [];
  saveTransactions();
  render();
});

elements.exportBtn.addEventListener("click", () => {
  const rows = selectedMonthTransactions();
  const header = ["Date", "Type", "Category", "Note", "Amount"];
  const csv = [
    header.join(","),
    ...rows.map((item) => [item.date, item.type, item.category, item.note, item.amount]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `finance-report-${elements.reportMonth.value}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

elements.date.value = todayISO();
elements.reportMonth.value = monthISO();
render();
