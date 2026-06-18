const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { readState, saveState, MONGODB_URI } = require("./lib/state");

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".bat": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml"
};

let store = null;

async function ensureStore() {
  if (!store) store = await readState();
  return store;
}

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

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
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

const server = http.createServer(async (req, res) => {
  await ensureStore();
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || "/";

  try {
    if (pathname === "/" || pathname === "/index.html" || pathname === "/style.css" || pathname === "/app.js" || pathname === "/open-chrome.bat") {
      const file = pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, pathname.slice(1));
      return sendFile(res, file);
    }

    if (pathname === "/api/summary" && req.method === "GET") {
      return json(res, 200, computeSummary());
    }

    if (pathname === "/api/state" && req.method === "GET") {
      if (!authOK(req)) return json(res, 401, { error: "Not authenticated" });
      return json(res, 200, { state: {
        sales: store.sales,
        cashflow: store.cashflow,
        employees: store.employees
      }, summary: computeSummary() });
    }

    if (pathname === "/api/auth" && req.method === "POST") {
      const body = await readBody(req);
      if (body.password !== "1234") return json(res, 401, { error: "Wrong password" });
      store.auth.loggedIn = true;
      await saveState(store);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": "nb_auth=1; Path=/; SameSite=Lax",
        "Cache-Control": "no-store"
      });
      return res.end(JSON.stringify({ ok: true, summary: computeSummary() }));
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      store.auth.loggedIn = false;
      await saveState(store);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": "nb_auth=; Path=/; Max-Age=0; SameSite=Lax",
        "Cache-Control": "no-store"
      });
      return res.end(JSON.stringify({ ok: true }));
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
      return json(res, 200, { state: { sales: store.sales, cashflow: store.cashflow, employees: store.employees }, summary: computeSummary() });
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
      return json(res, 200, { state: { sales: store.sales, cashflow: store.cashflow, employees: store.employees }, summary: computeSummary() });
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
      return json(res, 200, { state: { sales: store.sales, cashflow: store.cashflow, employees: store.employees }, summary: computeSummary() });
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch (err) {
    json(res, 500, { error: err.message || "Server error" });
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Please stop the other process or set PORT to a free port.`);
  } else {
    console.error("❌ Server error:", err);
  }
  process.exit(1);
});

async function startServer() {
  try {
    await ensureStore();
    server.listen(PORT, () => {
      console.log(`Nova Biz server running at http://localhost:${PORT}`);
      if (MONGODB_URI) {
        console.log(`MongoDB support enabled — ready to connect.`);
      } else {
        console.log(`MongoDB support disabled — using local data.json fallback.`);
      }
    });
  } catch (err) {
    console.error("❌ Startup failed:", err.message);
    process.exit(1);
  }
}

startServer();
