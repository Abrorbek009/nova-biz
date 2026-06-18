const path = require("path");
const url = require("url");
const { readState, saveState } = require("../lib/state");

let store = null;

async function ensureStore() {
  if (!store) store = await readState();
  return store;
}

const defaultState = {
  auth: { loggedIn: false },
  sales: [
    { product: "Smartfon", client: "Anvar", qty: 2, amount: 3200000 },
    { product: "Noutbuk", client: "Dilorom", qty: 1, amount: 5900000 },
    { product: "Aksessuar", client: "Aziz", qty: 5, amount: 750000 },
    { product: "Printer", client: "Gulnoza", qty: 1, amount: 2800000 },
    { product: "Planshet", client: "Sardor", qty: 3, amount: 3900000 }
  ],
  cashflow: [
    { title: "Bugungi tushum", amount: 1800000, type: "income" },
    { title: "Reklama xarajati", amount: 240000, type: "expense" },
    { title: "Yetkazib berish", amount: 130000, type: "expense" },
    { title: "Qo'shimcha kirim", amount: 1065000, type: "income" },
    { title: "Ofis ijarasi", amount: 1500000, type: "expense" }
  ],
  employees: [
    { name: "Dilshod Karimov", role: "Sotuv menejeri", status: "Faol" },
    { name: "Madina Akromova", role: "Kassir", status: "Band" },
    { name: "Javlonbek Ergashev", role: "Omborchi", status: "Damda" }
  ],
  dashboard: {
    weekly: [
      { label: "Dush", value: 68 },
      { label: "Sesh", value: 82 },
      { label: "Chor", value: 74 },
      { label: "Pay", value: 90 },
      { label: "Jum", value: 64 },
      { label: "Shan", value: 78 },
      { label: "Yak", value: 94 }
    ],
    monthly: [
      { label: "Yan", value: 18 },
      { label: "Fev", value: 24 },
      { label: "Mar", value: 34 },
      { label: "Apr", value: 31 },
      { label: "May", value: 47 },
      { label: "Iyun", value: 53 }
    ],
    activity: [
      { title: "Sotuv paneli ishga tushdi", time: "Bugun · 09:20" },
      { title: "Kassa yangilandi", time: "Bugun · 10:04" },
      { title: "Xodimlar holati sinxronlandi", time: "Bugun · 10:47" }
    ]
  }
};


function computeSummary() {
  const income = store.cashflow.filter(i => i.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = store.cashflow.filter(i => i.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const profit = income - expense;
  const orders = store.sales.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
  const maxWeekly = Math.max(...store.dashboard.weekly.map(p => p.value), 1);
  const maxMonthly = Math.max(...store.dashboard.monthly.map(p => p.value), 1);

  const monthly = store.dashboard.monthly.map(item => ({ ...item }));
  const salesChart = store.dashboard.weekly.map(item => ({
    label: item.label,
    percent: Math.round((item.value / maxWeekly) * 100)
  }));
  const topDeals = [...store.sales]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((item) => ({
      title: item.product,
      note: `${item.client} · ${item.qty} dona`,
      amount: item.amount
    }));
  const activity = [...store.dashboard.activity].slice(0, 6);

  return {
    authenticated: !!store.auth.loggedIn,
    income,
    expense,
    profit,
    orders,
    salesChart,
    monthly,
    topDeals,
    activity,
    peakMonth: monthly.find(item => item.value === maxMonthly)?.label || "Iyun"
  };
}

function json(res, code, payload) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function getCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((acc, part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function updateWeekly(amount) {
  const point = store.dashboard.weekly[store.dashboard.weekly.length - 1];
  point.value = Math.min(100, point.value + Math.max(1, Math.round(amount / 200000)));
  store.dashboard.weekly = [...store.dashboard.weekly.slice(1), point];
}

function updateMonthly(amount) {
  const point = store.dashboard.monthly[store.dashboard.monthly.length - 1];
  point.value += Math.max(1, Math.round(amount / 300000));
  store.dashboard.monthly = [...store.dashboard.monthly.slice(1), point];
}

function addActivity(title) {
  const now = new Date();
  const time = new Intl.DateTimeFormat("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);
  store.dashboard.activity.unshift({ title, time: `Bugun · ${time}` });
  store.dashboard.activity = store.dashboard.activity.slice(0, 8);
}

function authOK(req) {
  const cookies = getCookies(req);
  return cookies.nb_auth === "1";
}

module.exports = async (req, res) => {
  const parsed = url.parse(req.url || "", true);
  const pathname = parsed.pathname || "/";

  await ensureStore();

  try {
    if (pathname === "/api/summary" && req.method === "GET") {
      return json(res, 200, computeSummary());
    }

    if (pathname === "/api/state" && req.method === "GET") {
      if (!authOK(req)) return json(res, 401, { error: "Not authenticated" });
      return json(res, 200, {
        state: {
          sales: store.sales,
          cashflow: store.cashflow,
          employees: store.employees
        },
        summary: computeSummary()
      });
    }

    if (pathname === "/api/auth" && req.method === "POST") {
      const body = await readBody(req);
      if (body.password !== "1234") return json(res, 401, { error: "Wrong password" });
      store.auth.loggedIn = true;
      await saveState(store);
      return res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": "nb_auth=1; Path=/; SameSite=Lax; HttpOnly",
        "Cache-Control": "no-store"
      }), res.end(JSON.stringify({ ok: true, summary: computeSummary() }));
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      store.auth.loggedIn = false;
      await saveState(store);
      return res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": "nb_auth=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly",
        "Cache-Control": "no-store"
      }), res.end(JSON.stringify({ ok: true }));
    }

    if (pathname === "/api/sales" && req.method === "POST") {
      if (!authOK(req)) return json(res, 401, { error: "Not authenticated" });
      const body = await readBody(req);
      if (body.quick) {
        const amount = Math.floor(450000 + Math.random() * 1200000);
        store.sales.unshift({ product: "Tezkor buyurtma", client: "Walk-in", qty: 1, amount });
        store.cashflow.unshift({ title: "Tezkor sotuv", amount, type: "income" });
        updateWeekly(amount);
        updateMonthly(amount);
        addActivity(`Tezkor sotuv kiritildi · ${amount.toLocaleString("uz-UZ")} so'm`);
      } else {
        const product = body.product || "Mahsulot";
        const client = body.client || "Mijoz";
        const qty = Math.max(1, Number(body.qty || 1));
        const price = Math.max(0, Number(body.price || 0));
        const amount = qty * price;
        store.sales.unshift({ product, client, qty, amount });
        store.cashflow.unshift({ title: `${product} sotuvi`, amount, type: "income" });
        updateWeekly(amount);
        updateMonthly(amount);
        addActivity(`${product} sotildi · ${amount.toLocaleString("uz-UZ")} so'm`);
      }
      await saveState(store);
      return json(res, 200, {
        state: { sales: store.sales, cashflow: store.cashflow, employees: store.employees },
        summary: computeSummary()
      });
    }

    if (pathname === "/api/cashflow" && req.method === "POST") {
      if (!authOK(req)) return json(res, 401, { error: "Not authenticated" });
      const body = await readBody(req);
      const title = body.title || "Qo'shimcha harakat";
      const amount = Math.max(0, Number(body.amount || 0));
      const type = body.type === "expense" ? "expense" : "income";
      store.cashflow.unshift({ title, amount, type });
      if (type === "income") {
        updateWeekly(amount);
        updateMonthly(amount);
      }
      addActivity(`${type === "income" ? "Kirim" : "Chiqim"}: ${title}`);
      await saveState(store);
      return json(res, 200, {
        state: { sales: store.sales, cashflow: store.cashflow, employees: store.employees },
        summary: computeSummary()
      });
    }

    if (pathname === "/api/employees" && req.method === "POST") {
      if (!authOK(req)) return json(res, 401, { error: "Not authenticated" });
      const body = await readBody(req);
      const name = body.name || "Yangi xodim";
      const role = body.role || "Lavozim";
      const status = body.status || "Faol";
      store.employees.unshift({ name, role, status });
      addActivity(`Xodim qo'shildi: ${name}`);
      await saveState(store);
      return json(res, 200, {
        state: { sales: store.sales, cashflow: store.cashflow, employees: store.employees },
        summary: computeSummary()
      });
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch (err) {
    json(res, 500, { error: err.message || "Server error" });
  }
};
