/**
 * Autonomes WaiterBot - State Manager & Realtime Database Engine
 * Powered by LocalStorage + BroadcastChannel + Reactive Event Listeners
 * Supports Orders, Tables, Robot Telemetry, and Customer Feedback System (Rs. / LKR)
 */

const Store = (function () {
  const STORAGE_KEYS = {
    ORDERS: "waiterbot_orders",
    TABLES: "waiterbot_tables",
    ROBOT: "waiterbot_robot",
    FEEDBACKS: "waiterbot_feedbacks",
    STAFF_AUTH: "waiterbot_staff_auth",
    SETTINGS: "waiterbot_settings",
    THEME: "waiterbot_theme"
  };

  const syncChannel = typeof BroadcastChannel !== "undefined" 
    ? new BroadcastChannel("waiterbot_sync_channel") 
    : null;

  const listeners = new Set();

  // Audio synthesizer using Web Audio API (Zero external audio assets required)
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
    return {
      status: "idle", // 'idle' | 'in_transit' | 'at_table' | 'returning' | 'emergency_stopped'
      targetTable: null,
      activeOrderId: null,
      battery: 98,
      isCharging: false,
      barrierDetected: false,
      speed: 0.8, // m/s
      currentPos: { x: RESTAURANT_CONFIG.tableCoordinates[0].x, y: RESTAURANT_CONFIG.tableCoordinates[0].y },
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
    if (!localStorage.getItem(STORAGE_KEYS.FEEDBACKS)) {
      localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(getDefaultFeedbacks()));
    }

    // Initialize Theme immediately
    initTheme();

    // Listen to Storage events (different window/tab)
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
    return orders.find((o) => o.id === orderId || o.orderNumber === orderId) || null;
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
    return order;
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

  function updateRobotState(updates) {
    const robot = getRobotState();
    const updated = { ...robot, ...updates };
    localStorage.setItem(STORAGE_KEYS.ROBOT, JSON.stringify(updated));
    broadcast(STORAGE_KEYS.ROBOT, "ROBOT_UPDATED", updated);
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
    const targetCoords = RESTAURANT_CONFIG.tableCoordinates[tableNum];
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

    const homeCoords = RESTAURANT_CONFIG.tableCoordinates[0];

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
    if (pin === RESTAURANT_CONFIG.staffPin) {
      sessionStorage.setItem(STORAGE_KEYS.STAFF_AUTH, "true");
      return true;
    }
    return false;
  }

  function logoutStaff() {
    sessionStorage.removeItem(STORAGE_KEYS.STAFF_AUTH);
  }

  // --- Reset All / Seed Demo Data ---
  function resetAllData() {
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.TABLES);
    localStorage.removeItem(STORAGE_KEYS.ROBOT);
    localStorage.removeItem(STORAGE_KEYS.FEEDBACKS);
    init();
    broadcast("SYSTEM", "DATA_RESET", {});
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
    resetAllData,
    seedDemoOrder,
    getTheme,
    setTheme,
    toggleTheme,
    initTheme,
    soundFx,
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
  };
})();
