const API = {
  summary: "/api/summary",
  state: "/api/state",
  sales: "/api/sales",
  cashflow: "/api/cashflow",
  employees: "/api/employees",
  auth: "/api/auth"
};

const els = {
  loginScreen: document.getElementById("loginScreen"),
  appScreen: document.getElementById("appScreen"),
  loginForm: document.getElementById("loginForm"),
  logoutBtn: document.getElementById("logoutBtn"),
  quickSaleBtn: document.getElementById("quickSaleBtn"),
  toast: document.getElementById("toast"),
  toastTitle: document.getElementById("toastTitle"),
  toastText: document.getElementById("toastText"),
  today: document.getElementById("today"),
  incomeStat: document.getElementById("incomeStat"),
  expenseStat: document.getElementById("expenseStat"),
  profitStat: document.getElementById("profitStat"),
  ordersStat: document.getElementById("ordersStat"),
  profitIncomeText: document.getElementById("profitIncomeText"),
  profitExpenseText: document.getElementById("profitExpenseText"),
  netProfitText: document.getElementById("netProfitText"),
  salesList: document.getElementById("salesList"),
  cashflowList: document.getElementById("cashflowList"),
  employeeList: document.getElementById("employeeList"),
  salesChart: document.getElementById("salesChart"),
  navButtons: [...document.querySelectorAll("#nav button")],
  sections: [...document.querySelectorAll(".section")],
  monthlySpark: document.getElementById("monthlySpark"),
  topDeals: document.getElementById("topDeals"),
  activityFeed: document.getElementById("activityFeed"),
  currentMode: document.getElementById("currentMode")
};

const money = (n) => new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";

const app = {
  state: null,
  summary: null
};

function showToast(title, text) {
  els.toastTitle.textContent = title;
  els.toastText.textContent = text;
  els.toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2500);
}

async function requestJSON(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json();
}

function setMode(mode) {
  if (!els.currentMode) return;
  const labelMap = {
    dashboard: "Dashboard",
    sales: "Sotuv",
    cashflow: "Kirim / Chiqim",
    profit: "Foyda",
    employees: "Ishchilar"
  };
  els.currentMode.textContent = labelMap[mode] || "Dashboard";
}

function switchTab(tab) {
  els.navButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
  els.sections.forEach(section => section.classList.toggle("active", section.dataset.section === tab));
  document.body.dataset.activeTab = tab;
  setMode(tab);
  if (tab === "dashboard") {
    document.querySelectorAll('[data-section="dashboard"]').forEach(el => el.classList.add("active"));
  }
}

function renderSummary(summary) {
  els.incomeStat.textContent = money(summary.income);
  els.expenseStat.textContent = money(summary.expense);
  els.profitStat.textContent = money(summary.profit);
  els.ordersStat.textContent = summary.orders + " ta";
  els.profitIncomeText.textContent = money(summary.income);
  els.profitExpenseText.textContent = money(summary.expense);
  els.netProfitText.textContent = money(summary.profit);
}

function renderSales(list) {
  els.salesList.innerHTML = list.slice(0, 5).map((item, index) => `
    <div class="item">
      <div>
        <strong>${item.product}</strong>
        <span>${item.client} · ${item.qty} dona</span>
      </div>
      <span class="status ${index === 0 ? "ok" : "warn"}">${money(item.amount)}</span>
    </div>
  `).join("");
}

function renderCashflow(list) {
  els.cashflowList.innerHTML = list.slice(0, 6).map((item) => `
    <div class="item">
      <div>
        <strong>${item.title}</strong>
        <span>${item.type === "income" ? "Kirim" : "Chiqim"}</span>
      </div>
      <span class="status ${item.type === "income" ? "ok" : "bad"}">${item.type === "income" ? "+" : "-"} ${money(item.amount)}</span>
    </div>
  `).join("");
}

function renderEmployees(list) {
  els.employeeList.innerHTML = list.map((item) => `
    <div class="employee">
      <div class="avatar">${item.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</div>
      <div>
        <strong>${item.name}</strong>
        <div class="role">${item.role}</div>
      </div>
      <span class="badge">${item.status}</span>
    </div>
  `).join("");
}

function renderChart(summary) {
  const chart = summary.salesChart;
  els.salesChart.innerHTML = chart.map((point) => `
    <div class="row">
      <div class="muted">${point.label}</div>
      <div class="bar"><span style="width:${point.percent}%"></span></div>
      <div>${point.percent}%</div>
    </div>
  `).join("");
}

function renderSpark(summary) {
  const max = Math.max(...summary.monthly.map(v => v.value), 1);
  const width = 640;
  const height = 200;
  const pad = 12;
  const step = (width - pad * 2) / Math.max(summary.monthly.length - 1, 1);
  const points = summary.monthly.map((item, idx) => {
    const x = pad + idx * step;
    const y = height - pad - ((item.value / max) * (height - pad * 2));
    return { ...item, x, y };
  });
  const line = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${points[points.length - 1].x.toFixed(1)} ${height - pad} L ${points[0].x.toFixed(1)} ${height - pad} Z`;
  els.monthlySpark.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="spark-svg">
      <defs>
        <linearGradient id="sparkStroke" x1="0" x2="1">
          <stop offset="0%" stop-color="#73a9ff" />
          <stop offset="100%" stop-color="#68f0c3" />
        </linearGradient>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(104,240,195,0.32)" />
          <stop offset="100%" stop-color="rgba(104,240,195,0.03)" />
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#sparkFill)"></path>
      <path d="${line}" fill="none" stroke="url(#sparkStroke)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
      ${points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#eff4ff"></circle>`).join("")}
    </svg>
    <div class="spark-legend">
      ${summary.monthly.map((item) => `<span class="chip">${item.label}: ${money(item.value)}</span>`).join("")}
    </div>
  `;
}

function renderDeals(summary) {
  els.topDeals.innerHTML = summary.topDeals.map((item) => `
    <div class="line">
      <div>
        <b>${item.title}</b>
        <small>${item.note}</small>
      </div>
      <span class="status ok">${money(item.amount)}</span>
    </div>
  `).join("");
}

function renderActivity(summary) {
  els.activityFeed.innerHTML = summary.activity.map((item) => `
    <div class="timeline-item">
      <div class="dot"></div>
      <div>
        <b>${item.title}</b>
        <small>${item.time}</small>
      </div>
    </div>
  `).join("");
}

function renderAll() {
  if (!app.summary || !app.state) return;
  renderSummary(app.summary);
  renderSales(app.state.sales);
  renderCashflow(app.state.cashflow);
  renderEmployees(app.state.employees);
  renderChart(app.summary);
  renderSpark(app.summary);
  renderDeals(app.summary);
  renderActivity(app.summary);
}

async function loadState() {
  const data = await requestJSON(API.state);
  app.state = data.state;
  app.summary = data.summary;
  renderAll();
}

async function login() {
  await requestJSON(API.auth, {
    method: "POST",
    body: JSON.stringify({
      username: document.getElementById("username").value.trim(),
      password: document.getElementById("password").value.trim()
    })
  });
  els.loginScreen.classList.remove("active");
  els.appScreen.classList.add("active");
  await loadState();
  showToast("Xush kelibsiz", "Backend ulanishi bilan kreativ dashboard ochildi.");
}

async function logout() {
  await requestJSON(`${API.auth}/logout`, { method: "POST" }).catch(() => {});
  els.appScreen.classList.remove("active");
  els.loginScreen.classList.add("active");
  showToast("Chiqildi", "Siz tizimdan chiqdingiz.");
}

async function createSale() {
  const product = document.getElementById("productName").value.trim() || "Mahsulot";
  const client = document.getElementById("clientName").value.trim() || "Mijoz";
  const qty = Math.max(1, Number(document.getElementById("qty").value || 1));
  const price = Math.max(0, Number(document.getElementById("price").value || 0));
  const result = await requestJSON(API.sales, {
    method: "POST",
    body: JSON.stringify({ product, client, qty, price })
  });
  app.state = result.state;
  app.summary = result.summary;
  renderAll();
  showToast("Sotuv qo‘shildi", `${product} bo‘yicha ${money(qty * price)} tushum kiritildi.`);
}

async function createCashflow() {
  const title = document.getElementById("cashTitle").value.trim() || "Qo‘shimcha harakat";
  const amount = Math.max(0, Number(document.getElementById("cashAmount").value || 0));
  const type = document.getElementById("cashType").value;
  const result = await requestJSON(API.cashflow, {
    method: "POST",
    body: JSON.stringify({ title, amount, type })
  });
  app.state = result.state;
  app.summary = result.summary;
  renderAll();
  showToast("Pul harakati qo‘shildi", `${title} saqlandi.`);
}

async function createEmployee() {
  const name = document.getElementById("empName").value.trim() || "Yangi xodim";
  const role = document.getElementById("empRole").value.trim() || "Lavozim";
  const status = document.getElementById("empStatus").value;
  const result = await requestJSON(API.employees, {
    method: "POST",
    body: JSON.stringify({ name, role, status })
  });
  app.state = result.state;
  app.summary = result.summary;
  renderAll();
  showToast("Xodim qo‘shildi", `${name} ro‘yxatga kiritildi.`);
}

function bindEvents() {
  els.navButtons.forEach(btn => btn.addEventListener("click", () => {
    switchTab(btn.dataset.tab);
    showToast("Bo‘lim almashtirildi", `${btn.textContent} bo‘limi ochildi.`);
  }));

  els.loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    login().catch((err) => showToast("Kirish rad etildi", err.message));
  });

  els.logoutBtn.addEventListener("click", () => {
    logout().catch(() => {});
  });

  els.quickSaleBtn.addEventListener("click", () => {
    requestJSON(API.sales, { method: "POST", body: JSON.stringify({ quick: true }) })
      .then((result) => {
        app.state = result.state;
        app.summary = result.summary;
        renderAll();
        showToast("Sotuv qo‘shildi", "Yangi tezkor sotuv sahnaga qo‘shildi.");
      })
      .catch((err) => showToast("Xato", err.message));
  });

  document.getElementById("addSaleBtn").addEventListener("click", () => createSale().catch((err) => showToast("Xato", err.message)));
  document.getElementById("addCashBtn").addEventListener("click", () => createCashflow().catch((err) => showToast("Xato", err.message)));
  document.getElementById("addEmpBtn").addEventListener("click", () => createEmployee().catch((err) => showToast("Xato", err.message)));
}

async function init() {
  els.today.textContent = new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date());
  bindEvents();
  switchTab("dashboard");
  try {
    const summary = await requestJSON(API.summary);
    app.summary = summary;
    if (summary.authenticated) {
      els.loginScreen.classList.remove("active");
      els.appScreen.classList.add("active");
      await loadState();
    } else {
      renderAll();
    }
  } catch (err) {
    showToast("Backend topilmadi", "Server ishlamayapti. `node server.js` ni ishga tushiring.");
  }

  setInterval(async () => {
    if (!els.appScreen.classList.contains("active")) return;
    try {
      const fresh = await requestJSON(API.summary);
      app.summary = fresh;
      renderSummary(fresh);
    } catch {
      // no-op
    }
  }, 8000);
}

init();
