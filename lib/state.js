require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");

const ROOT = path.join(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data.json");
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB = process.env.MONGODB_DB || "yangi_diyor";
const COLLECTION_NAME = "app_state";
const STATE_ID = "dashboard_state";
let mongoClient;
let mongoConnected = false;

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

async function getMongoCollection() {
  if (!MONGODB_URI) return null;
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI, {
      serverApi: ServerApiVersion.v1
    });
  }
  if (!mongoClient.topology || !mongoClient.topology.isConnected()) {
    await mongoClient.connect();
    if (!mongoConnected) {
      mongoConnected = true;
      try {
        const parsedUri = new URL(MONGODB_URI);
        console.log(`✅ MongoDB connected to ${parsedUri.host} (db=${MONGODB_DB})`);
      } catch {
        console.log(`✅ MongoDB connected (db=${MONGODB_DB})`);
      }
    }
  }
  return mongoClient.db(MONGODB_DB).collection(COLLECTION_NAME);
}

function readJsonFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2), "utf8");
      return structuredClone(defaultState);
    }
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2), "utf8");
    return structuredClone(defaultState);
  }
}

function saveJsonFile(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function readState() {
  if (!MONGODB_URI) {
    console.log("⚠️ MONGODB_URI not configured. Using local data.json fallback.");
    return readJsonFile();
  }
  try {
    const collection = await getMongoCollection();
    const result = await collection.findOne({ _id: STATE_ID });
  if (result) {
    const { _id, ...state } = result;
    return {
      ...defaultState,
      ...state,
      auth: { ...defaultState.auth, ...(state.auth || {}) },
      dashboard: { ...defaultState.dashboard, ...(state.dashboard || {}) }
    };
  }
  await collection.replaceOne({ _id: STATE_ID }, { _id: STATE_ID, ...defaultState }, { upsert: true });
  return structuredClone(defaultState);
  } catch (err) {
    console.error("❌ MongoDB access failed:", err.message);
    console.log("⚠️ Falling back to local data.json storage.");
    return readJsonFile();
  }
}

async function saveState(data) {
  if (!MONGODB_URI) {
    return saveJsonFile(data);
  }
  const collection = await getMongoCollection();
  await collection.replaceOne({ _id: STATE_ID }, { _id: STATE_ID, ...data }, { upsert: true });
}

module.exports = {
  readState,
  saveState,
  defaultState,
  MONGODB_URI
};
