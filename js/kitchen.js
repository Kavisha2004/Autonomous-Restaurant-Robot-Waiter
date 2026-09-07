/**
 * Autonomes WaiterBot - Kitchen Staff Dashboard & Robot Control Center Logic
 * Real-time order queue management, 4-table monitoring, 2D floorplan radar, manual telemetry controls,
 * Order History Archive management, Master System Reset, and live Customer Feedback & Rating Monitoring (Sri Lankan Rupees Rs. / LKR).
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- 1. Staff PIN Security Gate ---
  const authGateModal = document.getElementById("authGateModal");
  const pinInput = document.getElementById("staffPinInput");
  const btnSubmitPin = document.getElementById("btnSubmitPin");
  const pinErrorMsg = document.getElementById("pinErrorMsg");
  const btnStaffLogout = document.getElementById("btnStaffLogout");

  function checkAuth() {
    if (!Store.isStaffAuthenticated()) {
      if (authGateModal) {
        authGateModal.classList.add("show");
      }
    } else {
      if (authGateModal) {
        authGateModal.classList.remove("show");
      }
    }
  }

  if (btnSubmitPin && pinInput) {
    btnSubmitPin.addEventListener("click", () => {
      const pin = pinInput.value.trim();
      if (Store.loginStaff(pin)) {
        if (pinErrorMsg) pinErrorMsg.style.display = "none";
        if (authGateModal) authGateModal.classList.remove("show");
        showToast("Staff Access Authorized. Welcome to Kitchen Command.", "success");
        renderAll();
      } else {
        if (pinErrorMsg) {
          pinErrorMsg.textContent = "Invalid PIN code. Please check staff credentials.";
          pinErrorMsg.style.display = "block";
        }
        pinInput.value = "";
        pinInput.focus();
      }
    });

    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnSubmitPin.click();
    });
  }

  if (btnStaffLogout) {
    btnStaffLogout.addEventListener("click", () => {
      Store.logoutStaff();
      window.location.href = "index.html";
    });
  }

  // Check auth initially
  checkAuth();

  // --- State Variables ---
  let activeFilter = "all";
  let historySearchTerm = "";

  // --- DOM Elements ---
  const metricActiveOrders = document.getElementById("metricActiveOrders");
  const metricPendingDeliveries = document.getElementById("metricPendingDeliveries");
  const metricOccupiedTables = document.getElementById("metricOccupiedTables");
  const metricRobotStatus = document.getElementById("metricRobotStatus");
  const metricTotalRevenue = document.getElementById("metricTotalRevenue");

  const tablesOverviewGrid = document.getElementById("tablesOverviewGrid");
  const ordersListContainer = document.getElementById("ordersListContainer");
  const filterPills = document.querySelectorAll(".filter-pill");

  // Robot Telemetry Elements
  const robotStatusBadge = document.getElementById("robotStatusBadge");
  const robotTargetTableElem = document.getElementById("robotTargetTable");
  const robotActiveOrderElem = document.getElementById("robotActiveOrder");
  const robotBatteryPercent = document.getElementById("robotBatteryPercent");
  const robotBatteryFill = document.getElementById("robotBatteryFill");
  const robotBarrierSensor = document.getElementById("robotBarrierSensor");
  const robotLogsBox = document.getElementById("robotLogsBox");
  const robotCanvasMarker = document.getElementById("robotCanvasMarker");

  // Feedback Elements
  const avgFoodRatingElem = document.getElementById("avgFoodRating");
  const avgRobotRatingElem = document.getElementById("avgRobotRating");
  const totalReviewsCountElem = document.getElementById("totalReviewsCount");
  const feedbackTotalBadgeElem = document.getElementById("feedbackTotalBadge");
  const feedbackListGrid = document.getElementById("feedbackListGrid");

  // Manual Controls & Toolbar
  const btnReturnHome = document.getElementById("btnReturnHome");
  const btnEmergencyStop = document.getElementById("btnEmergencyStop");
  const btnResetEmergency = document.getElementById("btnResetEmergency");
  const btnToggleBarrier = document.getElementById("btnToggleBarrier");
  const btnSeedDemoOrder = document.getElementById("btnSeedDemoOrder");
  const btnResetAllData = document.getElementById("btnResetAllData");

  // Clear Finished Orders & History Elements
  const btnClearFinishedOrders = document.getElementById("btnClearFinishedOrders");
  const btnOpenOrderHistory = document.getElementById("btnOpenOrderHistory");
  const historyBadgeCount = document.getElementById("historyBadgeCount");
  const modalOrderHistory = document.getElementById("modalOrderHistory");
  const btnCloseOrderHistory = document.getElementById("btnCloseOrderHistory");
  const btnDoneOrderHistory = document.getElementById("btnDoneOrderHistory");
  const historyTotalOrdersCount = document.getElementById("historyTotalOrdersCount");
  const historyTotalRevenue = document.getElementById("historyTotalRevenue");
  const historySearchInput = document.getElementById("historySearchInput");
  const orderHistoryListScroll = document.getElementById("orderHistoryListScroll");
  const btnExportOrderHistory = document.getElementById("btnExportOrderHistory");
  const btnClearHistoryArchive = document.getElementById("btnClearHistoryArchive");

  // Master Reset Elements
  const btnOpenMasterReset = document.getElementById("btnOpenMasterReset");
  const modalMasterReset = document.getElementById("modalMasterReset");
  const btnCancelMasterReset = document.getElementById("btnCancelMasterReset");
  const btnConfirmMasterReset = document.getElementById("btnConfirmMasterReset");

  // --- 2. Render Metrics Bar ---
  function renderMetrics() {
    const orders = Store.getOrders();
    const tables = Store.getTables();
    const robot = Store.getRobotState();
    const history = Store.getOrderHistory();

    const activeOrdersList = orders.filter((o) => o.status !== "delivered");
    const pendingDeliveriesList = orders.filter((o) => o.status === "ready" || o.status === "delivering");
    const occupiedTablesList = tables.filter((t) => t.status !== "empty");
    const totalRev = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    if (metricActiveOrders) metricActiveOrders.textContent = activeOrdersList.length;
    if (metricPendingDeliveries) metricPendingDeliveries.textContent = pendingDeliveriesList.length;
    if (metricOccupiedTables) metricOccupiedTables.textContent = `${occupiedTablesList.length}/4`;
    if (metricTotalRevenue) metricTotalRevenue.textContent = `${RESTAURANT_CONFIG.currency}${totalRev.toFixed(2)}`;

    if (metricRobotStatus) {
      metricRobotStatus.textContent = robot.status.replace("_", " ").toUpperCase();
      metricRobotStatus.style.color = robot.status === "emergency_stopped" ? "#DC2626" : 
                                     robot.status === "in_transit" || robot.status === "at_table" ? "#059669" : "#6F4525";
    }

    if (historyBadgeCount) {
      historyBadgeCount.textContent = history.length;
    }
  }

  // --- 3. Render 4 Tables Status Cards ---
  function renderTablesOverview() {
    if (!tablesOverviewGrid) return;

    const tables = Store.getTables();
    const orders = Store.getOrders();

    tablesOverviewGrid.innerHTML = tables.map((t) => {
      // Find active order for this table
      const activeOrder = orders.find((o) => o.id === t.activeOrderId || (o.tableNumber === t.id && o.status !== "delivered"));

      let statusBadgeClass = "badge-delivered";
      let statusLabel = "Empty";

      if (t.status === "ordered") {
        statusBadgeClass = "badge-new";
        statusLabel = "New Order";
      } else if (t.status === "preparing") {
        statusBadgeClass = "badge-preparing";
        statusLabel = "Cooking";
      } else if (t.status === "waiting_delivery") {
        statusBadgeClass = "badge-ready";
        statusLabel = "Ready for Robot";
      } else if (t.status === "delivering") {
        statusBadgeClass = "badge-delivering";
        statusLabel = "Robot En Route";
      } else if (t.status === "delivered") {
        statusBadgeClass = "badge-delivered";
        statusLabel = "Delivered";
      }

      const isOccupied = t.status !== "empty";

      return `
        <div class="table-status-card ${isOccupied ? 'occupied' : ''} ${t.status === 'delivering' ? 'delivering' : ''}" id="card-table-${t.id}">
          <div class="table-card-top">
            <span class="table-title-id">Table ${t.id}</span>
            <span class="badge ${statusBadgeClass}">● ${statusLabel}</span>
          </div>
          <div class="table-card-details">
            ${isOccupied && activeOrder ? `
              <div style="font-weight: 700; color: var(--wood-dark); margin-bottom: 0.2rem;">${escapeHtml(activeOrder.customerName)}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${activeOrder.items.length} items &bull; ${RESTAURANT_CONFIG.currency}${activeOrder.total.toFixed(2)}</div>
              <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--wood-primary); margin-top: 0.25rem;">${activeOrder.orderNumber}</div>
            ` : `
              <div style="color: var(--text-light); font-style: italic; padding: 0.4rem 0;">Ready for guests</div>
            `}
          </div>
          <div style="display: flex; gap: 0.4rem; margin-top: auto; border-top: 1px dashed var(--wood-soft); padding-top: 0.6rem;">
            ${isOccupied && activeOrder && activeOrder.status === 'ready' ? `
              <button class="btn btn-robot-dispatch btn-sm btn-quick-dispatch" data-table="${t.id}" data-order="${activeOrder.id}" style="width: 100%;">
                🤖 Dispatch Robot
              </button>
            ` : isOccupied ? `
              <button class="btn btn-secondary btn-sm btn-reset-table" data-table="${t.id}" style="width: 100%; font-size: 0.78rem;">
                Clear Table
              </button>
            ` : `
              <span style="font-size: 0.75rem; color: var(--text-light); width: 100%; text-align: center;">Waiting QR Scan</span>
            `}
          </div>
        </div>
      `;
    }).join("");

    // Attach quick dispatch listeners
    tablesOverviewGrid.querySelectorAll(".btn-quick-dispatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tableNum = parseInt(btn.getAttribute("data-table"), 10);
        const orderId = btn.getAttribute("data-order");
        Store.dispatchRobotToTable(tableNum, orderId);
      });
    });

    // Attach clear table listeners
    tablesOverviewGrid.querySelectorAll(".btn-reset-table").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tableNum = parseInt(btn.getAttribute("data-table"), 10);
        Store.resetTable(tableNum);
        showToast(`Table ${tableNum} cleared and reset to empty`, "info");
      });
    });
  }

  // --- 4. Render Kitchen Orders Queue ---
  function renderOrdersQueue() {
    if (!ordersListContainer) return;

    const orders = Store.getOrders();

    let filtered = orders;
    if (activeFilter !== "all") {
      filtered = orders.filter((o) => o.status === activeFilter);
    }

    if (filtered.length === 0) {
      ordersListContainer.innerHTML = `
        <div style="text-align: center; padding: 3.5rem 1.5rem; background: #FFFFFF; border-radius: var(--radius-xl); border: 1px solid var(--wood-border);">
          <svg style="width: 50px; height: 50px; stroke: var(--wood-light); margin-bottom: 1rem;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h4 style="color: var(--wood-dark); font-size: 1.15rem; margin-bottom: 0.25rem;">No Orders in this View</h4>
          <p style="font-size: 0.88rem; color: var(--text-muted);">Incoming customer orders from Table 1-4 will automatically appear here in real-time.</p>
        </div>
      `;
      return;
    }

    ordersListContainer.innerHTML = filtered.map((order) => {
      return `
        <div class="kitchen-order-card status-${order.status}" id="order-card-${order.id}">
          <div class="order-card-header">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span class="order-id-badge">${order.orderNumber}</span>
              <span class="badge" style="background: var(--wood-soft); color: var(--wood-dark); border: 1px solid var(--wood-border); font-weight: 800;">
                TABLE ${order.tableNumber}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span style="font-size: 0.78rem; color: var(--text-light);">
                ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span class="badge badge-${order.status}">
                ● ${order.status.replace("_", " ")}
              </span>
            </div>
          </div>

          <div class="order-card-body">
            <div class="order-customer-meta">
              <span><strong>Guest:</strong> ${escapeHtml(order.customerName)}</span>
              <span style="font-weight: 800; color: var(--wood-primary); font-size: 1.05rem;">
                ${RESTAURANT_CONFIG.currency}${order.total.toFixed(2)}
              </span>
            </div>

            <div class="order-items-list">
              ${order.items.map((it) => `
                <div class="order-item-line">
                  <div>
                    <span class="item-qty">${it.qty}x</span>
                    <span>${escapeHtml(it.name)}</span>
                  </div>
                  <span style="color: var(--text-muted); font-size: 0.85rem;">
                    ${RESTAURANT_CONFIG.currency}${(it.price * it.qty).toFixed(2)}
                  </span>
                </div>
              `).join("")}
            </div>

            ${order.specialNote && order.specialNote !== "No special requests" && order.specialNote !== "None" ? `
              <div class="special-note-box">
                <span style="font-size: 1.1rem;">⚠️</span>
                <div>
                  <strong>Special Note / Allergy:</strong> ${escapeHtml(order.specialNote)}
                </div>
              </div>
            ` : ""}

            <div class="order-card-actions">
              ${order.status === "new" ? `
                <button class="btn btn-amber btn-sm btn-mark-preparing" data-id="${order.id}">
                  🍳 Start Preparing
                </button>
              ` : ""}

              ${order.status === "preparing" ? `
                <button class="btn btn-primary btn-sm btn-mark-ready" data-id="${order.id}">
                  🍱 Mark Ready for Delivery
                </button>
              ` : ""}

              ${order.status === "ready" ? `
                <button class="btn btn-robot-dispatch btn-sm btn-send-robot" data-id="${order.id}" data-table="${order.tableNumber}">
                  🤖 Send WaiterBot to Table ${order.tableNumber}
                </button>
              ` : ""}

              ${order.status === "delivering" ? `
                <button class="btn btn-success btn-sm btn-mark-delivered" data-id="${order.id}">
                  ✓ Mark Delivered & Received
                </button>
              ` : ""}

              ${order.status === "delivered" ? `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 0.5rem;">
                  <span style="font-size: 0.85rem; color: var(--status-delivering); font-weight: 700; display: inline-flex; align-items: center; gap: 0.3rem;">
                    ✓ Order Delivered & Completed
                  </span>
                  <button class="btn btn-secondary btn-sm btn-archive-single-order" data-id="${order.id}" title="Archive this finished order to history file">
                    <span>📦 Move to History</span>
                  </button>
                </div>
              ` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Attach order workflow button listeners
    ordersListContainer.querySelectorAll(".btn-mark-preparing").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        Store.updateOrderStatus(id, "preparing");
        showToast("Order status updated to Preparing", "info");
      });
    });

    ordersListContainer.querySelectorAll(".btn-mark-ready").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        Store.updateOrderStatus(id, "ready");
        showToast("Order is packed & ready for Robot loading", "info");
      });
    });

    ordersListContainer.querySelectorAll(".btn-send-robot").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const tableNum = parseInt(btn.getAttribute("data-table"), 10);
        Store.dispatchRobotToTable(tableNum, id);
        showToast(`WaiterBot dispatched to Table ${tableNum}!`, "success");
      });
    });

    ordersListContainer.querySelectorAll(".btn-mark-delivered").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        Store.updateOrderStatus(id, "delivered");
        Store.returnRobotHome();
        showToast("Order marked Delivered. Robot returning to home dock.", "success");
      });
    });

    // Single order archive button
    ordersListContainer.querySelectorAll(".btn-archive-single-order").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const success = Store.archiveOrderById(id);
        if (success) {
          showToast("Order moved to Order History archive file.", "success");
          renderAll();
        }
      });
    });
  }

  // Filter Pills listener
  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      activeFilter = pill.getAttribute("data-filter");
      renderOrdersQueue();
    });
  });

  // --- 5. Render Robot Telemetry & 2D Floorplan Radar ---
  function renderRobotTelemetry() {
    const robot = Store.getRobotState();

    if (robotStatusBadge) {
      robotStatusBadge.className = `badge badge-${robot.status === 'emergency_stopped' ? 'emergency' : robot.status === 'in_transit' || robot.status === 'at_table' ? 'delivering' : 'delivered'}`;
      robotStatusBadge.textContent = `● ${robot.status.replace("_", " ").toUpperCase()}`;
    }

    if (robotTargetTableElem) {
      robotTargetTableElem.textContent = robot.targetTable ? `Table ${robot.targetTable}` : "Home Dock / Station";
    }

    if (robotActiveOrderElem) {
      robotActiveOrderElem.textContent = robot.activeOrderId ? robot.activeOrderId : "None (Standby)";
    }

    if (robotBatteryPercent) {
      robotBatteryPercent.textContent = `${robot.battery}%`;
    }
    if (robotBatteryFill) {
      robotBatteryFill.style.width = `${robot.battery}%`;
      robotBatteryFill.style.background = robot.battery < 20 ? "#EF4444" : robot.battery < 50 ? "#F59E0B" : "linear-gradient(90deg, #10B981, #059669)";
    }

    if (robotBarrierSensor) {
      if (robot.barrierDetected) {
        robotBarrierSensor.innerHTML = `<span style="color: #DC2626; font-weight: 800;">⚠️ Obstacle Detected</span>`;
      } else {
        robotBarrierSensor.innerHTML = `<span style="color: #059669; font-weight: 700;">✓ Clear Path</span>`;
      }
    }

    // Update 2D Canvas Position
    if (robotCanvasMarker) {
      if (robot.status === "emergency_stopped") {
        robotCanvasMarker.classList.add("emergency");
      } else {
        robotCanvasMarker.classList.remove("emergency");
      }

      // Position coordinates
      const pos = robot.currentPos || RESTAURANT_CONFIG.tableCoordinates[0];
      robotCanvasMarker.style.left = `${pos.x}%`;
      robotCanvasMarker.style.top = `${pos.y}%`;
    }

    // Highlight target table node on floor map
    document.querySelectorAll(".floor-node").forEach((node) => {
      const nodeTableId = parseInt(node.getAttribute("data-node-table"), 10);
      if (robot.targetTable !== null && robot.targetTable === nodeTableId) {
        node.classList.add("active-target");
      } else {
        node.classList.remove("active-target");
      }
    });

    // Render Logs Stream
    if (robotLogsBox) {
      robotLogsBox.innerHTML = robot.logs.map((log) => `
        <div class="log-entry">
          <span class="log-time">[${log.time}]</span>
          <span class="log-msg ${log.type}">${escapeHtml(log.msg)}</span>
        </div>
      `).join("");
    }
  }

  // --- 6. Render Customer Feedback & Reviews ---
  function renderFeedbackSection() {
    const feedbacks = Store.getFeedbacks();
    const stats = Store.getFeedbackStats();

    if (avgFoodRatingElem) avgFoodRatingElem.textContent = `${stats.avgFood} ★`;
    if (avgRobotRatingElem) avgRobotRatingElem.textContent = `${stats.avgRobot} ★`;
    if (totalReviewsCountElem) totalReviewsCountElem.textContent = stats.totalCount;
    if (feedbackTotalBadgeElem) feedbackTotalBadgeElem.textContent = `${stats.totalCount} Reviews Received`;

    if (!feedbackListGrid) return;

    if (feedbacks.length === 0) {
      feedbackListGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-light); background: #FFFFFF; border-radius: var(--radius-lg); border: 1px solid var(--wood-border);">
          <p>No customer reviews submitted yet. Guest ratings will automatically appear here once meals are completed.</p>
        </div>
      `;
      return;
    }

    feedbackListGrid.innerHTML = feedbacks.map((fb) => {
      const foodStarsStr = "★".repeat(fb.foodRating || 5) + "☆".repeat(5 - (fb.foodRating || 5));
      const robotStarsStr = "★".repeat(fb.robotRating || 5) + "☆".repeat(5 - (fb.robotRating || 5));
      const dateStr = fb.createdAt ? new Date(fb.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';

      return `
        <div class="feedback-item-card">
          <div class="feedback-item-top">
            <div>
              <strong style="color: var(--wood-dark); font-size: 1rem; display: block;">${escapeHtml(fb.customerName || "Table Guest")}</strong>
              <span class="badge badge-new" style="font-size: 0.72rem; padding: 0.15rem 0.5rem; margin-top: 0.2rem;">
                Table ${fb.tableNumber || 1}
              </span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-light); font-weight: 600;">
              ${dateStr}
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem; background: var(--bg-main); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--wood-soft);">
            <div style="font-size: 0.8rem; display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted); font-weight: 600;">🍱 Food Quality:</span>
              <span class="feedback-stars">${foodStarsStr}</span>
            </div>
            <div style="font-size: 0.8rem; display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted); font-weight: 600;">🤖 Robot Delivery:</span>
              <span class="feedback-stars">${robotStarsStr}</span>
            </div>
          </div>

          ${fb.tags && fb.tags.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.6rem;">
              ${fb.tags.map((t) => `<span class="badge" style="background: var(--wood-soft); color: var(--wood-dark); font-size: 0.7rem; border: 1px solid var(--wood-border);">${escapeHtml(t)}</span>`).join("")}
            </div>
          ` : ""}

          ${fb.comment ? `
            <p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-top: auto; padding-top: 0.4rem; border-top: 1px dashed var(--wood-soft);">
              "${escapeHtml(fb.comment)}"
            </p>
          ` : ""}
        </div>
      `;
    }).join("");
  }

  // --- 7. Order History Modal & Logic ---
  function renderOrderHistory() {
    const history = Store.getOrderHistory();
    const totalArchivedRev = history.reduce((sum, o) => sum + (o.total || 0), 0);

    if (historyTotalOrdersCount) historyTotalOrdersCount.textContent = history.length;
    if (historyTotalRevenue) historyTotalRevenue.textContent = `${RESTAURANT_CONFIG.currency}${totalArchivedRev.toFixed(2)}`;
    if (historyBadgeCount) historyBadgeCount.textContent = history.length;

    if (!orderHistoryListScroll) return;

    let filtered = history;
    if (historySearchTerm) {
      const q = historySearchTerm.toLowerCase();
      filtered = history.filter((o) => {
        const orderNumMatch = (o.orderNumber || "").toLowerCase().includes(q);
        const nameMatch = (o.customerName || "").toLowerCase().includes(q);
        const tableMatch = String(o.tableNumber).includes(q);
        const itemMatch = o.items && o.items.some((i) => (i.name || "").toLowerCase().includes(q));
        return orderNumMatch || nameMatch || tableMatch || itemMatch;
      });
    }

    if (filtered.length === 0) {
      orderHistoryListScroll.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; background: var(--bg-main); border-radius: var(--radius-lg); border: 1px dashed var(--wood-border); color: var(--text-muted);">
          <svg style="width: 38px; height: 38px; stroke: var(--wood-light); margin-bottom: 0.5rem;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div style="font-weight: 700; color: var(--wood-dark); margin-bottom: 0.2rem;">
            ${historySearchTerm ? "No matching orders found" : "Order History Archive is Empty"}
          </div>
          <div style="font-size: 0.8rem; color: var(--text-light);">
            ${historySearchTerm ? "Try a different search keyword." : "Completed (delivered) orders cleared from the dashboard will be permanently saved here."}
          </div>
        </div>
      `;
      return;
    }

    orderHistoryListScroll.innerHTML = filtered.map((item) => {
      const orderDate = item.createdAt ? new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent';
      const archivedDate = item.archivedAt ? new Date(item.archivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div style="background: var(--bg-main); border: 1px solid var(--wood-border); border-radius: var(--radius-md); padding: 0.85rem 1rem; transition: transform var(--transition-fast);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.4rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <strong style="font-family: var(--font-mono); color: var(--wood-dark); font-size: 0.95rem;">${item.orderNumber}</strong>
              <span class="badge" style="background: var(--wood-soft); color: var(--wood-dark); font-size: 0.72rem; font-weight: 700;">
                Table ${item.tableNumber}
              </span>
              <span class="badge badge-${item.status}" style="font-size: 0.72rem;">
                ● ${item.status.toUpperCase()}
              </span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-light);">
              Ordered: ${orderDate} ${archivedDate ? `&bull; Archived: ${archivedDate}` : ''}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.85rem;">
            <span><strong>Guest:</strong> ${escapeHtml(item.customerName)}</span>
            <strong style="color: var(--wood-primary); font-size: 0.95rem;">${RESTAURANT_CONFIG.currency}${(item.total || 0).toFixed(2)}</strong>
          </div>

          <div style="font-size: 0.8rem; color: var(--text-muted); background: #FFFFFF; padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--wood-soft); line-height: 1.4;">
            ${(item.items || []).map((i) => `${i.qty}x ${escapeHtml(i.name)}`).join(", ")}
          </div>
        </div>
      `;
    }).join("");
  }

  // --- 8. Event Listeners for Clear Finished Orders & History Modal ---
  if (btnClearFinishedOrders) {
    btnClearFinishedOrders.addEventListener("click", () => {
      const archivedCount = Store.archiveFinishedOrders();
      if (archivedCount > 0) {
        showToast(`🧹 Archived ${archivedCount} finished order(s) into History file.`, "success");
      } else {
        showToast("No finished (delivered) orders to clear right now.", "info");
      }
      renderAll();
    });
  }

  if (btnOpenOrderHistory) {
    btnOpenOrderHistory.addEventListener("click", () => {
      renderOrderHistory();
      if (modalOrderHistory) modalOrderHistory.classList.add("show");
    });
  }

  if (btnCloseOrderHistory) {
    btnCloseOrderHistory.addEventListener("click", () => {
      if (modalOrderHistory) modalOrderHistory.classList.remove("show");
    });
  }

  if (btnDoneOrderHistory) {
    btnDoneOrderHistory.addEventListener("click", () => {
      if (modalOrderHistory) modalOrderHistory.classList.remove("show");
    });
  }

  if (historySearchInput) {
    historySearchInput.addEventListener("input", (e) => {
      historySearchTerm = e.target.value.trim();
      renderOrderHistory();
    });
  }

  if (btnExportOrderHistory) {
    btnExportOrderHistory.addEventListener("click", () => {
      Store.exportOrderHistory();
      showToast("📥 Exported and downloaded waiterbot_orders_history.json file.", "success");
    });
  }

  if (btnClearHistoryArchive) {
    btnClearHistoryArchive.addEventListener("click", () => {
      if (confirm("Are you sure you want to permanently delete all archived history records?")) {
        Store.clearOrderHistory();
        renderOrderHistory();
        showToast("Order history archive cleared.", "info");
      }
    });
  }

  // Close modals when clicking backdrop
  if (modalOrderHistory) {
    modalOrderHistory.addEventListener("click", (e) => {
      if (e.target === modalOrderHistory) {
        modalOrderHistory.classList.remove("show");
      }
    });
  }

  // --- 9. Event Listeners for Master System Reset ---
  if (btnOpenMasterReset) {
    btnOpenMasterReset.addEventListener("click", () => {
      if (modalMasterReset) modalMasterReset.classList.add("show");
    });
  }

  if (btnCancelMasterReset) {
    btnCancelMasterReset.addEventListener("click", () => {
      if (modalMasterReset) modalMasterReset.classList.remove("show");
    });
  }

  if (btnConfirmMasterReset) {
    btnConfirmMasterReset.addEventListener("click", () => {
      Store.masterResetAll();
      if (modalMasterReset) modalMasterReset.classList.remove("show");
      showToast("✨ Master System Reset Complete: All orders, tables, robot state, and feedback reset to default.", "success");
      renderAll();
    });
  }

  if (modalMasterReset) {
    modalMasterReset.addEventListener("click", (e) => {
      if (e.target === modalMasterReset) {
        modalMasterReset.classList.remove("show");
      }
    });
  }

  // --- 10. Manual Robot Control Action Buttons ---
  document.querySelectorAll(".btn-manual-dispatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tableNum = parseInt(btn.getAttribute("data-table"), 10);
      Store.dispatchRobotToTable(tableNum);
      showToast(`Manual command: Dispatched Robot to Table ${tableNum}`, "info");
    });
  });

  if (btnReturnHome) {
    btnReturnHome.addEventListener("click", () => {
      Store.returnRobotHome();
      showToast("Manual command: Returning Robot to Home Dock", "info");
    });
  }

  if (btnEmergencyStop) {
    btnEmergencyStop.addEventListener("click", () => {
      Store.emergencyStop();
      showToast("🚨 EMERGENCY STOP ACTIVATED! Robot locked in place.", "error");
    });
  }

  if (btnResetEmergency) {
    btnResetEmergency.addEventListener("click", () => {
      Store.resetEmergency();
      showToast("Emergency state cleared. Robot ready for orders.", "success");
    });
  }

  if (btnToggleBarrier) {
    btnToggleBarrier.addEventListener("click", () => {
      const state = Store.toggleBarrierSensor();
      showToast(`Ultrasonic Barrier Sensor: ${state ? 'OBSTACLE SIMULATED' : 'PATH CLEARED'}`, state ? "warning" : "success");
    });
  }

  if (btnSeedDemoOrder) {
    btnSeedDemoOrder.addEventListener("click", () => {
      Store.seedDemoOrder();
      showToast("Generated realistic demo order for Table 1!", "success");
    });
  }

  if (btnResetAllData) {
    btnResetAllData.addEventListener("click", () => {
      if (confirm("Reset all orders, tables, and robot states to fresh default?")) {
        Store.masterResetAll();
        showToast("System database reset successfully.", "info");
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- 11. Realtime Subscription & Auto Polling ---
  function renderAll() {
    renderMetrics();
    renderTablesOverview();
    renderOrdersQueue();
    renderRobotTelemetry();
    renderFeedbackSection();
  }

  Store.subscribe((event) => {
    renderAll();
  });

  // Fallback periodic refresh (every 2.5 seconds)
  setInterval(() => {
    renderAll();
  }, 2500);

  // Toast notification helper
  function showToast(msg, type = "info") {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Initial render
  renderAll();
});
