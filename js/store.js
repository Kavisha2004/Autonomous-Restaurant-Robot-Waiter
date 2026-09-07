/**
 * Autonomes WaiterBot - State Manager & Realtime Database Engine
 * Powered by Supabase Cloud Database + Realtime Subscriptions + LocalStorage Fallback
 * Supports Orders, Order History Archive, Tables, Robot Telemetry, and Customer Feedback System (Rs. / LKR)
 */

const Store = (function () {
  const STORAGE_KEYS = {
    ORDERS: "waiterbot_orders",
    ORDER_HISTORY: "waiterbot_order_history",
    TABLES: "waiterbot_tables",
    ROBOT: "waiterbot_robot",
    FEEDBACKS: "waiterbot_feedbacks",
    STAFF_AUTH: "waiterbot_staff_auth",
    SETTINGS: "waiterbot_settings",
    THEME: "waiterbot_theme",
    SUPABASE_STATUS: "waiterbot_supabase_status"
  };

  const syncChannel = typeof BroadcastChannel !== "undefined" 
    ? new BroadcastChannel("waiterbot_sync_channel") 
    : null;

  const listeners = new Set();
  const statusListeners = new Set();

  let supabaseClient = null;
  let supabaseConnected = false;
  let realtimeChannel = null;

  // --- Audio synthesizer using Web Audio API (Zero external audio assets required) ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, type, duration, delay = 0, gainLevel = 0.15) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime + delay;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(gainLevel, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn("Audio chime disabled or blocked by browser policy:", e);
    }
  }

  const soundFx = {
    newOrder: () => {
      // Pleasant double chime: C5 -> G5
      playTone(523.25, "sine", 0.35, 0, 0.2);
      playTone(783.99, "sine", 0.5, 0.15, 0.22);
    },
    robotDispatch: () => {
      // Sci-fi rising chirp
      playTone(440, "triangle", 0.2, 0, 0.15);
      playTone(660, "triangle", 0.2, 0.12, 0.18);
      playTone(880, "sine", 0.4, 0.24, 0.2);
    },
    robotArrived: () => {
      // Friendly arrival fanfare: C5 -> E5 -> G5
      playTone(523.25, "sine", 0.25, 0, 0.2);
      playTone(659.25, "sine", 0.25, 0.15, 0.2);
      playTone(783.99, "sine", 0.5, 0.3, 0.25);
    },
    emergency: () => {
      // Urgent siren tone
      playTone(880, "sawtooth", 0.25, 0, 0.3);
      playTone(440, "sawtooth", 0.25, 0.25, 0.3);
      playTone(880, "sawtooth", 0.25, 0.5, 0.3);
    },
    success: () => {
      playTone(587.33, "sine", 0.2, 0, 0.18);
      playTone(880, "sine", 0.4, 0.15, 0.2);
    }
  };

  // --- Initial Default States ---
  function getDefaultTables() {
    return [
      { id: 1, name: "Table 1", status: "empty", activeOrderId: null, customerName: "", lastUpdated: Date.now() },
      { id: 2, name: "Table 2", status: "empty", activeOrderId: null, customerName: "", lastUpdated: Date.now() },
      { id: 3, name: "Table 3", status: "empty", activeOrderId: null, customerName: "", lastUpdated: Date.now() },
      { id: 4, name: "Table 4", status: "empty", activeOrderId: null, customerName: "", lastUpdated: Date.now() }
    ];
  }

  function getDefaultRobot() {
    const coords = (typeof RESTAURANT_CONFIG !== "undefined" && RESTAURANT_CONFIG.tableCoordinates)
      ? RESTAURANT_CONFIG.tableCoordinates[0]
      : { x: 12, y: 50 };

    return {
      status: "idle", // 'idle' | 'in_transit' | 'at_table' | 'returning' | 'emergency_stopped'
      targetTable: null,
      activeOrderId: null,
      battery: 98,
      isCharging: false,
      barrierDetected: false,
      speed: 0.8, // m/s
      currentPos: { x: coords.x, y: coords.y },
      logs: [
        { time: new Date().toLocaleTimeString(), msg: "Autonomous WaiterBot system initialized. Docked at Home Base.", type: "success" }
      ]
    };
  }

  function getDefaultFeedbacks() {
    return [
      {
        id: "fb_demo_1",
        tableNumber: 2,
        customerName: "Kasun & Sanduni",
        foodRating: 5,
        robotRating: 5,
        tags: ["🚀 Fast Robot Delivery", "🍱 Hot & Fresh Food", "🤖 Loved the Robot"],
        comment: "Amazing automated service! The robot arrived smoothly right by our table without spilling a drop.",
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: "fb_demo_2",
        tableNumber: 3,
        customerName: "Dr. Perera",
        foodRating: 5,
        robotRating: 4,
        tags: ["✨ Great Atmosphere", "👌 Friendly Service"],
        comment: "Very impressive robotics project demonstration. The ramen was delicious and piping hot.",
        createdAt: new Date(Date.now() - 7200000).toISOString()
      }
    ];
  }

  // --- Database Mapping Helpers ---
  function orderToDb(o) {
    return {
      id: o.id,
      order_number: o.orderNumber || o.id,
      table_number: parseInt(o.tableNumber, 10),
      customer_name: o.customerName || "",
      special_note: o.specialNote || "",
      items: o.items || [],
      subtotal: parseFloat(o.subtotal || 0),
      tax: parseFloat(o.tax || 0),
      total: parseFloat(o.total || 0),
      status: o.status || "new",
      timeline: o.timeline || [],
      created_at: o.createdAt || new Date().toISOString(),
      updated_at: o.updatedAt || new Date().toISOString()
    };
  }

  function orderFromDb(row) {
    return {
      id: row.id,
      orderNumber: row.order_number || row.id,
      tableNumber: parseInt(row.table_number, 10),
      customerName: row.customer_name || `Guest (Table ${row.table_number})`,
      specialNote: row.special_note || "",
      items: row.items || [],
      subtotal: parseFloat(row.subtotal || 0),
      tax: parseFloat(row.tax || 0),
      total: parseFloat(row.total || 0),
      status: row.status || "new",
      timeline: row.timeline || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function tableToDb(t) {
    return {
      id: parseInt(t.id, 10),
      name: t.name || `Table ${t.id}`,
      status: t.status || "empty",
      active_order_id: t.activeOrderId || null,
      customer_name: t.customerName || "",
      last_updated: new Date(t.lastUpdated || Date.now()).toISOString()
    };
  }

  function tableFromDb(row) {
    return {
      id: parseInt(row.id, 10),
      name: row.name || `Table ${row.id}`,
      status: row.status || "empty",
      activeOrderId: row.active_order_id || null,
      customerName: row.customer_name || "",
      lastUpdated: row.last_updated ? new Date(row.last_updated).getTime() : Date.now()
    };
  }

  function robotToDb(r) {
    return {
      id: 1,
      status: r.status || "idle",
      target_table: r.targetTable || null,
      active_order_id: r.activeOrderId || null,
      battery: parseInt(r.battery || 98, 10),
      is_charging: Boolean(r.isCharging),
      barrier_detected: Boolean(r.barrierDetected),
      speed: parseFloat(r.speed || 0.8),
      current_pos: r.currentPos || { x: 12, y: 50 },
      logs: r.logs || [],
      updated_at: new Date().toISOString()
    };
  }

  function robotFromDb(row) {
    return {
      status: row.status || "idle",
      targetTable: row.target_table || null,
      activeOrderId: row.active_order_id || null,
      battery: parseInt(row.battery || 98, 10),
      isCharging: Boolean(row.is_charging),
      barrierDetected: Boolean(row.barrier_detected),
      speed: parseFloat(row.speed || 0.8),
      currentPos: row.current_pos || { x: 12, y: 50 },
      logs: row.logs || []
    };
  }

  function feedbackToDb(f) {
    return {
      id: f.id,
      table_number: parseInt(f.tableNumber, 10),
      customer_name: f.customerName || "Table Guest",
      food_rating: parseInt(f.foodRating, 10) || 5,
      robot_rating: parseInt(f.robotRating, 10) || 5,
      tags: f.tags || [],
      comment: f.comment || "",
      created_at: f.createdAt || new Date().toISOString()
    };
  }

  function feedbackFromDb(row) {
    return {
      id: row.id,
      tableNumber: parseInt(row.table_number, 10),
      customerName: row.customer_name || "Table Guest",
      foodRating: parseInt(row.food_rating, 10) || 5,
      robotRating: parseInt(row.robot_rating, 10) || 5,
      tags: row.tags || [],
      comment: row.comment || "",
      createdAt: row.created_at
    };
  }

  // --- Initialize Supabase Client ---
  function initSupabase() {
    if (typeof window !== "undefined" && window.supabase && typeof SUPABASE_CONFIG !== "undefined" && SUPABASE_CONFIG.enabled && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log("⚡ Supabase Client initialized with:", SUPABASE_CONFIG.url);
        initRealtime();
        fetchFromSupabase();
      } catch (err) {
        console.warn("⚠️ Supabase Client init error:", err);
        setSupabaseStatus(false, "Init error");
      }
    } else {
      console.log("ℹ️ Supabase running in local fallback mode.");
      setSupabaseStatus(false, "Local storage mode");
    }
  }

  function setSupabaseStatus(connected, message = "") {
    supabaseConnected = connected;
    const statusData = {
      connected: connected,
      status: connected ? "connected" : "local",
      message: message,
      url: typeof SUPABASE_CONFIG !== "undefined" ? SUPABASE_CONFIG.url : ""
    };
    statusListeners.forEach((cb) => {
      try { cb(statusData); } catch (e) {}
    });
    updateCloudBadge(statusData);
  }

  function updateCloudBadge(statusData) {
    document.querySelectorAll(".supabase-cloud-badge").forEach((badge) => {
      if (statusData.connected) {
        badge.classList.remove("badge-local", "badge-error");
        badge.classList.add("badge-connected");
        badge.innerHTML = `
          <span class="badge-pulse-dot online"></span>
          <span>Supabase Cloud Connected</span>
        `;
        badge.setAttribute("title", `Connected to Supabase (${statusData.url}) with Live Realtime sync.`);
      } else {
        badge.classList.remove("badge-connected", "badge-error");
        badge.classList.add("badge-local");
        badge.innerHTML = `
          <span class="badge-pulse-dot local"></span>
          <span>Local Sync Mode</span>
        `;
        badge.setAttribute("title", statusData.message || "Running on Local Storage sync");
      }
    });
  }

  // --- Realtime Postgres Subscriptions ---
  function initRealtime() {
    if (!supabaseClient) return;

    try {
      if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
      }

      realtimeChannel = supabaseClient
        .channel("waiterbot_realtime_stream")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
          handleRealtimeOrder(payload);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "tables_status" }, (payload) => {
          handleRealtimeTable(payload);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "robot_state" }, (payload) => {
          handleRealtimeRobot(payload);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "feedbacks" }, (payload) => {
          handleRealtimeFeedback(payload);
        })
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            console.log("🟢 Supabase Realtime Stream Connected & Subscribed!");
            setSupabaseStatus(true, "Live Realtime Subscribed");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("⚠️ Supabase Realtime channel status:", status, err);
            setSupabaseStatus(false, `Realtime ${status}`);
          }
        });
    } catch (e) {
      console.warn("⚠️ Realtime subscription setup error:", e);
    }
  }

  function handleRealtimeOrder(payload) {
    const orders = getOrders();
    const eventType = payload.eventType; // 'INSERT' | 'UPDATE' | 'DELETE'
    const newRow = payload.new;
    const oldRow = payload.old;

    if (eventType === "INSERT" && newRow) {
      const order = orderFromDb(newRow);
      const existingIdx = orders.findIndex((o) => o.id === order.id);
      if (existingIdx === -1) {
        orders.unshift(order);
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
        soundFx.newOrder();
        notifyListeners({ key: STORAGE_KEYS.ORDERS, action: "ORDER_CREATED", payload: order, source: "supabase" });
      }
    } else if (eventType === "UPDATE" && newRow) {
      const order = orderFromDb(newRow);
      const existingIdx = orders.findIndex((o) => o.id === order.id);
      if (existingIdx !== -1) {
        orders[existingIdx] = order;
      } else {
        orders.unshift(order);
      }
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      notifyListeners({ key: STORAGE_KEYS.ORDERS, action: "STATUS_UPDATED", payload: order, source: "supabase" });
    } else if (eventType === "DELETE" && oldRow) {
      const filtered = orders.filter((o) => o.id !== oldRow.id);
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(filtered));
      notifyListeners({ key: STORAGE_KEYS.ORDERS, action: "ORDER_DELETED", payload: oldRow, source: "supabase" });
    }
  }

  function handleRealtimeTable(payload) {
    const tables = getTables();
    const eventType = payload.eventType;
    const newRow = payload.new;

    if ((eventType === "INSERT" || eventType === "UPDATE") && newRow) {
      const table = tableFromDb(newRow);
      const idx = tables.findIndex((t) => t.id === table.id);
      if (idx !== -1) {
        tables[idx] = table;
      } else {
        tables.push(table);
      }
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
      notifyListeners({ key: STORAGE_KEYS.TABLES, action: "TABLE_UPDATED", payload: table, source: "supabase" });
    }
  }

  function handleRealtimeRobot(payload) {
    const eventType = payload.eventType;
    const newRow = payload.new;

    if ((eventType === "INSERT" || eventType === "UPDATE") && newRow) {
      const robot = robotFromDb(newRow);
      localStorage.setItem(STORAGE_KEYS.ROBOT, JSON.stringify(robot));
      notifyListeners({ key: STORAGE_KEYS.ROBOT, action: "ROBOT_UPDATED", payload: robot, source: "supabase" });
    }
  }

  function handleRealtimeFeedback(payload) {
    const feedbacks = getFeedbacks();
    const eventType = payload.eventType;
    const newRow = payload.new;
    const oldRow = payload.old;

    if (eventType === "INSERT" && newRow) {
      const fb = feedbackFromDb(newRow);
      const exists = feedbacks.some((f) => f.id === fb.id);
      if (!exists) {
        feedbacks.unshift(fb);
        localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(feedbacks));
        soundFx.success();
        notifyListeners({ key: STORAGE_KEYS.FEEDBACKS, action: "FEEDBACK_SUBMITTED", payload: fb, source: "supabase" });
      }
    } else if (eventType === "DELETE") {
      if (oldRow && oldRow.id) {
        const filtered = feedbacks.filter((f) => f.id !== oldRow.id);
        localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(filtered));
      } else {
        localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify([]));
      }
      notifyListeners({ key: STORAGE_KEYS.FEEDBACKS, action: "FEEDBACK_DELETED", payload: oldRow, source: "supabase" });
    }
  }

  // --- Fetch Initial Data from Supabase ---
  async function fetchFromSupabase() {
    if (!supabaseClient) return;

    try {
      // 1. Orders
      const { data: ordersData, error: ordersErr } = await supabaseClient
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (!ordersErr && ordersData) {
        const parsedOrders = ordersData.map(orderFromDb);
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(parsedOrders));
        notifyListeners({ key: STORAGE_KEYS.ORDERS, action: "SUPABASE_FETCH", payload: parsedOrders });
      }

      // 2. Tables
      const { data: tablesData, error: tablesErr } = await supabaseClient
        .from("tables_status")
        .select("*")
        .order("id", { ascending: true });

      if (!tablesErr && tablesData && tablesData.length > 0) {
        const parsedTables = tablesData.map(tableFromDb);
        localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(parsedTables));
        notifyListeners({ key: STORAGE_KEYS.TABLES, action: "SUPABASE_FETCH", payload: parsedTables });
      }

      // 3. Robot State
      const { data: robotData, error: robotErr } = await supabaseClient
        .from("robot_state")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (!robotErr && robotData) {
        const parsedRobot = robotFromDb(robotData);
        localStorage.setItem(STORAGE_KEYS.ROBOT, JSON.stringify(parsedRobot));
        notifyListeners({ key: STORAGE_KEYS.ROBOT, action: "SUPABASE_FETCH", payload: parsedRobot });
      }

      // 4. Feedbacks
      const { data: fbData, error: fbErr } = await supabaseClient
        .from("feedbacks")
        .select("*")
        .order("created_at", { ascending: false });

      if (!fbErr && fbData) {
        const parsedFb = fbData.map(feedbackFromDb);
        localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(parsedFb));
        notifyListeners({ key: STORAGE_KEYS.FEEDBACKS, action: "SUPABASE_FETCH", payload: parsedFb });
      }

      if (!ordersErr && !tablesErr) {
        setSupabaseStatus(true, "Synced with Supabase Cloud");
      }
    } catch (e) {
      console.warn("⚠️ Error fetching data from Supabase:", e);
      setSupabaseStatus(false, "Could not fetch remote tables");
    }
  }

  // --- Initialize Storage ---
  function init() {
    if (!localStorage.getItem(STORAGE_KEYS.TABLES)) {
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(getDefaultTables()));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ROBOT)) {
      localStorage.setItem(STORAGE_KEYS.ROBOT, JSON.stringify(getDefaultRobot()));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ORDER_HISTORY)) {
      localStorage.setItem(STORAGE_KEYS.ORDER_HISTORY, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.FEEDBACKS)) {
      localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(getDefaultFeedbacks()));
    }

    // Initialize Theme immediately
    initTheme();

    // Listen to Storage events (different window/tab on same origin)
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEYS.THEME) {
        applyTheme(e.newValue || "light");
      }
      if (Object.values(STORAGE_KEYS).includes(e.key)) {
        notifyListeners({ key: e.key, source: "storage_event" });
      }
    });

    // Listen to BroadcastChannel events
    if (syncChannel) {
      syncChannel.onmessage = (msg) => {
        if (msg.data && msg.data.key === STORAGE_KEYS.THEME && msg.data.payload && msg.data.payload.theme) {
          applyTheme(msg.data.payload.theme);
        }
        notifyListeners(msg.data);
      };
    }

    // Connect to Supabase
    initSupabase();
  }

  // --- Theme State Management (Light / Dark) ---
  function getTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === "dark" || saved === "light") {
      return saved;
    }
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function setTheme(theme) {
    const validTheme = theme === "dark" ? "dark" : "light";
    localStorage.setItem(STORAGE_KEYS.THEME, validTheme);
    applyTheme(validTheme);
    broadcast(STORAGE_KEYS.THEME, "THEME_CHANGE", { theme: validTheme });
  }

  function toggleTheme() {
    const current = getTheme();
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
    return next;
  }

  function initTheme() {
    const theme = getTheme();
    applyTheme(theme);

    // Wire up any theme toggle buttons on the page
    document.querySelectorAll(".theme-toggle-btn, #btnThemeToggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggleTheme();
      });
    });
  }

  function notifyListeners(data) {
    listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error("Store listener callback error:", err);
      }
    });
  }

  function broadcast(key, action, payload) {
    const data = { key, action, payload, timestamp: Date.now() };
    if (syncChannel) {
      try {
        syncChannel.postMessage(data);
      } catch (e) {
        console.warn("BroadcastChannel error:", e);
      }
    }
    notifyListeners(data);
  }

  // --- Orders CRUD ---
  function getOrders() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function getOrderById(orderId) {
    const orders = getOrders();
    const active = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (active) return active;
    const history = getOrderHistory();
    return history.find((o) => o.id === orderId || o.orderNumber === orderId) || null;
  }

  function createOrder(orderPayload) {
    const orders = getOrders();
    const tableNum = parseInt(orderPayload.tableNumber, 10);
    const orderCount = orders.length + 1;
    const orderNumber = `ORD-${String(orderCount).padStart(4, "0")}`;
    const newId = "ord_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

    const newOrder = {
      id: newId,
      orderNumber: orderNumber,
      tableNumber: tableNum,
      customerName: orderPayload.customerName || `Guest (Table ${tableNum})`,
      specialNote: orderPayload.specialNote || "None",
      items: orderPayload.items || [],
      subtotal: parseFloat(orderPayload.subtotal || 0),
      tax: parseFloat(orderPayload.tax || 0),
      total: parseFloat(orderPayload.total || 0),
      status: "new", // 'new' | 'preparing' | 'ready' | 'delivering' | 'delivered'
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [
        { status: "new", label: "Order Placed", time: new Date().toLocaleTimeString() }
      ]
    };

    orders.unshift(newOrder);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    // Update Table status to 'ordered'
    updateTableState(tableNum, "ordered", newOrder.id, newOrder.customerName);

    // Audio chime
    soundFx.newOrder();

    broadcast(STORAGE_KEYS.ORDERS, "ORDER_CREATED", newOrder);

    // Push to Supabase Cloud Asynchronously
    if (supabaseClient) {
      supabaseClient
        .from("orders")
        .insert(orderToDb(newOrder))
        .then(({ error }) => {
          if (error) {
            console.warn("⚠️ Supabase order insert notice:", error.message);
          } else {
            console.log("☁️ Order synced to Supabase:", newOrder.id);
          }
        })
        .catch((err) => console.warn("Supabase network error:", err));
    }

    return newOrder;
  }

  function updateOrderStatus(orderId, newStatus) {
    const orders = getOrders();
    const orderIndex = orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);

    if (orderIndex === -1) return null;

    const order = orders[orderIndex];
    order.status = newStatus;
    order.updatedAt = new Date().toISOString();

    const statusLabels = {
      new: "Order Placed",
      preparing: "Preparing in Kitchen",
      ready: "Food Ready for Dispatch",
      delivering: "Robot En Route to Table",
      delivered: "Delivered & Completed"
    };

    order.timeline.push({
      status: newStatus,
      label: statusLabels[newStatus] || newStatus,
      time: new Date().toLocaleTimeString()
    });

    orders[orderIndex] = order;
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    // Also sync table state
    const tableNum = order.tableNumber;
    let tableStatusMap = {
      new: "ordered",
      preparing: "preparing",
      ready: "waiting_delivery",
      delivering: "delivering",
      delivered: "delivered"
    };
    if (tableStatusMap[newStatus]) {
      updateTableState(tableNum, tableStatusMap[newStatus], order.id, order.customerName);
    }

    broadcast(STORAGE_KEYS.ORDERS, "STATUS_UPDATED", order);

    // Sync to Supabase
    if (supabaseClient) {
      supabaseClient
        .from("orders")
        .update(orderToDb(order))
        .eq("id", order.id)
        .then(({ error }) => {
          if (error) console.warn("Supabase order update notice:", error.message);
        })
        .catch((err) => console.warn("Supabase order update network error:", err));
    }

    return order;
  }

  // --- Order History Archive & Clear Finished Orders ---
  function getOrderHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDER_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function archiveFinishedOrders() {
    const orders = getOrders();
    const finishedOrders = orders.filter((o) => o.status === "delivered" || o.status === "cancelled");
    const activeOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");

    if (finishedOrders.length === 0) return 0;

    const history = getOrderHistory();
    // Prepend newly finished orders to history avoiding duplicates
    finishedOrders.forEach((finished) => {
      finished.archivedAt = new Date().toISOString();
      const exists = history.some((h) => h.id === finished.id);
      if (!exists) {
        history.unshift(finished);
      }
    });

    localStorage.setItem(STORAGE_KEYS.ORDER_HISTORY, JSON.stringify(history));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(activeOrders));

    broadcast(STORAGE_KEYS.ORDERS, "FINISHED_ORDERS_ARCHIVED", { count: finishedOrders.length });
    return finishedOrders.length;
  }

  function archiveOrderById(orderId) {
    const orders = getOrders();
    const targetIdx = orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
    if (targetIdx === -1) return false;

    const [order] = orders.splice(targetIdx, 1);
    order.archivedAt = new Date().toISOString();

    const history = getOrderHistory();
    history.unshift(order);

    localStorage.setItem(STORAGE_KEYS.ORDER_HISTORY, JSON.stringify(history));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    broadcast(STORAGE_KEYS.ORDERS, "ORDER_ARCHIVED", order);
    return true;
  }

  function clearOrderHistory() {
    localStorage.setItem(STORAGE_KEYS.ORDER_HISTORY, JSON.stringify([]));
    broadcast(STORAGE_KEYS.ORDER_HISTORY, "HISTORY_CLEARED", {});
    return true;
  }

  function exportOrderHistory() {
    const history = getOrderHistory();
    const active = getOrders();
    const exportPayload = {
      exportTimestamp: new Date().toISOString(),
      restaurant: typeof RESTAURANT_CONFIG !== "undefined" ? RESTAURANT_CONFIG.name : "Autonomes WaiterBot",
      totalArchivedOrders: history.length,
      archivedOrders: history,
      activeOrders: active
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `waiterbot_orders_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    return true;
  }

  // --- Tables State ---
  function getTables() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TABLES);
      return data ? JSON.parse(data) : getDefaultTables();
    } catch (e) {
      return getDefaultTables();
    }
  }

  function updateTableState(tableNum, status, activeOrderId = null, customerName = "") {
    const tables = getTables();
    const table = tables.find((t) => t.id === parseInt(tableNum, 10));
    if (table) {
      table.status = status;
      if (activeOrderId !== undefined) table.activeOrderId = activeOrderId;
      if (customerName) table.customerName = customerName;
      table.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
      broadcast(STORAGE_KEYS.TABLES, "TABLE_UPDATED", table);

      // Sync to Supabase
      if (supabaseClient) {
        supabaseClient
          .from("tables_status")
          .upsert(tableToDb(table))
          .then(({ error }) => {
            if (error) console.warn("Supabase table upsert notice:", error.message);
          })
          .catch((err) => console.warn("Supabase table update error:", err));
      }
    }
  }

  function resetTable(tableNum) {
    const tables = getTables();
    const table = tables.find((t) => t.id === parseInt(tableNum, 10));
    if (table) {
      table.status = "empty";
      table.activeOrderId = null;
      table.customerName = "";
      table.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
      broadcast(STORAGE_KEYS.TABLES, "TABLE_RESET", table);

      if (supabaseClient) {
        supabaseClient
          .from("tables_status")
          .upsert(tableToDb(table))
          .then(({ error }) => {
            if (error) console.warn("Supabase table reset notice:", error.message);
          })
          .catch((err) => console.warn("Supabase table reset error:", err));
      }
    }
  }

  // --- Robot State & Telemetry ---
  function getRobotState() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ROBOT);
      return data ? JSON.parse(data) : getDefaultRobot();
    } catch (e) {
      return getDefaultRobot();
    }
  }

  let robotSyncDebounce = null;
  function updateRobotState(updates) {
    const robot = getRobotState();
    const updated = { ...robot, ...updates };
    localStorage.setItem(STORAGE_KEYS.ROBOT, JSON.stringify(updated));
    broadcast(STORAGE_KEYS.ROBOT, "ROBOT_UPDATED", updated);

    // Debounced sync to Supabase for high frequency position/telemetry updates
    if (supabaseClient) {
      if (robotSyncDebounce) clearTimeout(robotSyncDebounce);
      robotSyncDebounce = setTimeout(() => {
        supabaseClient
          .from("robot_state")
          .upsert(robotToDb(updated))
          .then(({ error }) => {
            if (error) console.warn("Supabase robot update notice:", error.message);
          })
          .catch((err) => console.warn("Supabase robot update network error:", err));
      }, 300);
    }

    return updated;
  }

  function addRobotLog(msg, type = "info") {
    const robot = getRobotState();
    const entry = {
      time: new Date().toLocaleTimeString(),
      msg: msg,
      type: type // 'info' | 'success' | 'warning' | 'danger'
    };
    robot.logs.unshift(entry);
    if (robot.logs.length > 50) robot.logs.pop();
    updateRobotState({ logs: robot.logs });
  }

  // --- Robot Navigation Simulations ---
  let robotAnimationTimer = null;

  function dispatchRobotToTable(tableNum, orderId = null) {
    const targetCoords = (typeof RESTAURANT_CONFIG !== "undefined" && RESTAURANT_CONFIG.tableCoordinates)
      ? RESTAURANT_CONFIG.tableCoordinates[tableNum]
      : null;

    if (!targetCoords) return false;

    // Check if emergency stopped
    const currentRobot = getRobotState();
    if (currentRobot.status === "emergency_stopped") {
      addRobotLog(`Cannot dispatch robot: Emergency Stop is active! Reset emergency first.`, "danger");
      return false;
    }

    if (robotAnimationTimer) clearTimeout(robotAnimationTimer);

    soundFx.robotDispatch();

    // 1. Set state to in_transit
    updateRobotState({
      status: "in_transit",
      targetTable: tableNum,
      activeOrderId: orderId,
      currentPos: { x: targetCoords.x, y: targetCoords.y }
    });

    addRobotLog(`Dispatched to Table ${tableNum} (${targetCoords.name}). Delivering order: ${orderId || 'Manual Mission'}.`, "info");

    // If there is an associated order, update its status
    if (orderId) {
      updateOrderStatus(orderId, "delivering");
    }

    // 2. Simulate arrival at table after 4.5 seconds
    robotAnimationTimer = setTimeout(() => {
      const stateCheck = getRobotState();
      if (stateCheck.status === "emergency_stopped") return;

      soundFx.robotArrived();
      updateRobotState({
        status: "at_table",
        targetTable: tableNum,
        battery: Math.max(10, stateCheck.battery - 2)
      });
      addRobotLog(`Arrived at Table ${tableNum}! Waiting for customer to unload tray.`, "success");
    }, 4500);

    return true;
  }

  function returnRobotHome() {
    const currentRobot = getRobotState();
    if (currentRobot.status === "emergency_stopped") {
      addRobotLog(`Cannot return home: Emergency Stop is active!`, "danger");
      return false;
    }

    if (robotAnimationTimer) clearTimeout(robotAnimationTimer);

    const homeCoords = (typeof RESTAURANT_CONFIG !== "undefined" && RESTAURANT_CONFIG.tableCoordinates)
      ? RESTAURANT_CONFIG.tableCoordinates[0]
      : { x: 12, y: 50 };

    updateRobotState({
      status: "returning",
      targetTable: 0,
      currentPos: { x: homeCoords.x, y: homeCoords.y }
    });

    addRobotLog(`Returning to Home Dock / Kitchen Station.`, "info");

    robotAnimationTimer = setTimeout(() => {
      const stateCheck = getRobotState();
      if (stateCheck.status === "emergency_stopped") return;

      updateRobotState({
        status: "idle",
        targetTable: null,
        activeOrderId: null,
        currentPos: { x: homeCoords.x, y: homeCoords.y },
        battery: Math.min(100, stateCheck.battery + 5)
      });
      addRobotLog(`Docked at Kitchen Home Base. Standby for next order.`, "success");
    }, 4000);

    return true;
  }

  function emergencyStop() {
    if (robotAnimationTimer) clearTimeout(robotAnimationTimer);
    soundFx.emergency();
    updateRobotState({
      status: "emergency_stopped",
      barrierDetected: true
    });
    addRobotLog(`⚠️ EMERGENCY STOP TRIGGERED! Robot halted instantly.`, "danger");
  }

  function resetEmergency() {
    soundFx.success();
    updateRobotState({
      status: "idle",
      targetTable: null,
      activeOrderId: null,
      barrierDetected: false
    });
    addRobotLog(`Emergency stop cleared. System resumed normal standby.`, "success");
  }

  function toggleBarrierSensor() {
    const robot = getRobotState();
    const newState = !robot.barrierDetected;
    updateRobotState({ barrierDetected: newState });
    if (newState) {
      soundFx.emergency();
      addRobotLog(`⚠️ Ultrasonic Proximity Sensor: Obstacle / Barrier detected on path! Robot decelerated.`, "warning");
    } else {
      soundFx.success();
      addRobotLog(`Sensor cleared: Path is clear.`, "info");
    }
    return newState;
  }

  // --- Customer Feedback CRUD ---
  function getFeedbacks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FEEDBACKS);
      return data ? JSON.parse(data) : getDefaultFeedbacks();
    } catch (e) {
      return getDefaultFeedbacks();
    }
  }

  function saveFeedback(feedbackPayload) {
    const feedbacks = getFeedbacks();
    const newFeedback = {
      id: "fb_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      tableNumber: parseInt(feedbackPayload.tableNumber, 10) || 1,
      customerName: feedbackPayload.customerName || "Table Guest",
      foodRating: parseInt(feedbackPayload.foodRating, 10) || 5,
      robotRating: parseInt(feedbackPayload.robotRating, 10) || 5,
      tags: feedbackPayload.tags || [],
      comment: feedbackPayload.comment || "",
      createdAt: new Date().toISOString()
    };

    feedbacks.unshift(newFeedback);
    localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(feedbacks));

    soundFx.success();
    broadcast(STORAGE_KEYS.FEEDBACKS, "FEEDBACK_SUBMITTED", newFeedback);

    // Sync to Supabase
    if (supabaseClient) {
      supabaseClient
        .from("feedbacks")
        .insert(feedbackToDb(newFeedback))
        .then(({ error }) => {
          if (error) console.warn("Supabase feedback insert notice:", error.message);
        })
        .catch((err) => console.warn("Supabase feedback insert error:", err));
    }

    return newFeedback;
  }

  function getFeedbackStats() {
    const feedbacks = getFeedbacks();
    if (feedbacks.length === 0) {
      return { avgFood: 5.0, avgRobot: 5.0, totalCount: 0 };
    }
    const totalFood = feedbacks.reduce((sum, f) => sum + (f.foodRating || 5), 0);
    const totalRobot = feedbacks.reduce((sum, f) => sum + (f.robotRating || 5), 0);
    return {
      avgFood: (totalFood / feedbacks.length).toFixed(1),
      avgRobot: (totalRobot / feedbacks.length).toFixed(1),
      totalCount: feedbacks.length
    };
  }

  // --- Staff Authentication Gate ---
  function isStaffAuthenticated() {
    return sessionStorage.getItem(STORAGE_KEYS.STAFF_AUTH) === "true";
  }

  function loginStaff(pin) {
    if (typeof RESTAURANT_CONFIG !== "undefined" && pin === RESTAURANT_CONFIG.staffPin) {
      sessionStorage.setItem(STORAGE_KEYS.STAFF_AUTH, "true");
      return true;
    }
    return false;
  }

  function logoutStaff() {
    sessionStorage.removeItem(STORAGE_KEYS.STAFF_AUTH);
  }

  // --- Reset All / Master Details Reset ---
  function masterResetAll() {
    const defaultTables = getDefaultTables();
    const defaultRobot = getDefaultRobot();

    // 1. Wipe all active orders
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
    // 2. Wipe all archived order history
    localStorage.setItem(STORAGE_KEYS.ORDER_HISTORY, JSON.stringify([]));
    // 3. Wipe all customer feedbacks
    localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify([]));
    // 4. Reset all tables to empty
    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(defaultTables));
    // 5. Reset robot to home dock
    localStorage.setItem(STORAGE_KEYS.ROBOT, JSON.stringify(defaultRobot));

    broadcast("SYSTEM", "MASTER_RESET", {});
    broadcast(STORAGE_KEYS.ORDERS, "RESET", []);
    broadcast(STORAGE_KEYS.ORDER_HISTORY, "RESET", []);
    broadcast(STORAGE_KEYS.FEEDBACKS, "RESET", []);
    broadcast(STORAGE_KEYS.TABLES, "RESET", defaultTables);
    broadcast(STORAGE_KEYS.ROBOT, "RESET", defaultRobot);

    if (supabaseClient) {
      // 1. Reset tables in Supabase
      supabaseClient.from("tables_status").upsert(defaultTables.map(tableToDb)).then(() => {});
      // 2. Reset robot state in Supabase
      supabaseClient.from("robot_state").upsert(robotToDb(defaultRobot)).then(() => {});
      // 3. Delete all active orders from Supabase
      supabaseClient.from("orders").delete().neq("id", "___none___").then(({ error }) => {
        if (error) console.warn("Supabase delete orders error:", error.message);
      });
      // 4. Delete all customer feedbacks from Supabase
      supabaseClient.from("feedbacks").delete().neq("id", "___none___").then(({ error }) => {
        if (error) console.warn("Supabase delete feedbacks error:", error.message);
      });
    }
  }

  function seedDemoOrder() {
    createOrder({
      tableNumber: 1,
      customerName: "Kamal & Nimali",
      specialNote: "Please provide extra lime and cutlery sets.",
      items: [
        { id: "n1", name: "Artisan Tonkotsu Smoked Ramen", price: 2150.00, qty: 2 },
        { id: "d2", name: "Sparkling Lychee Dragonfruit Soda", price: 750.00, qty: 2 },
        { id: "s1", name: "Matcha Molten Lava Cake", price: 1150.00, qty: 1 }
      ],
      subtotal: 6950.00,
      tax: 556.00,
      total: 7506.00
    });
  }

  // Initialize on script load
  init();

  return {
    getOrders,
    getOrderById,
    createOrder,
    updateOrderStatus,
    getOrderHistory,
    archiveFinishedOrders,
    archiveOrderById,
    clearOrderHistory,
    exportOrderHistory,
    getTables,
    updateTableState,
    resetTable,
    getRobotState,
    updateRobotState,
    addRobotLog,
    dispatchRobotToTable,
    returnRobotHome,
    emergencyStop,
    resetEmergency,
    toggleBarrierSensor,
    getFeedbacks,
    saveFeedback,
    getFeedbackStats,
    isStaffAuthenticated,
    loginStaff,
    logoutStaff,
    resetAllData: masterResetAll,
    masterResetAll,
    seedDemoOrder,
    getTheme,
    setTheme,
    toggleTheme,
    initTheme,
    soundFx,
    isSupabaseConnected: () => supabaseConnected,
    getSupabaseClient: () => supabaseClient,
    syncWithSupabase: fetchFromSupabase,
    onSupabaseStatusChange: (callback) => {
      statusListeners.add(callback);
      callback({
        connected: supabaseConnected,
        status: supabaseConnected ? "connected" : "local",
        url: typeof SUPABASE_CONFIG !== "undefined" ? SUPABASE_CONFIG.url : ""
      });
      return () => statusListeners.delete(callback);
    },
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
  };
})();
