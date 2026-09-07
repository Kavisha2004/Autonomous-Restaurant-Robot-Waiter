/**
 * Autonomes WaiterBot - Customer Table Ordering Interface Logic
 * Handles dynamic table detection, menu browsing, cart checkout, live order tracking,
 * and post-delivery Customer Feedback & Star Ratings (Sri Lankan Rupees Rs. / LKR).
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Detect Table Number from URL
  const urlParams = new URLSearchParams(window.location.search);
  let tableParam = parseInt(urlParams.get("table"), 10);

  // Fallback if table param is not 1-4
  if (!tableParam || tableParam < 1 || tableParam > RESTAURANT_CONFIG.totalTables) {
    tableParam = 1; // Default to Table 1
  }

  const currentTableId = tableParam;
  let activeCategory = "all";
  let searchQuery = "";
  let cart = []; // Array of { id, name, price, qty, image }
  let activeOrder = null;
  let feedbackPromptedForOrderId = null;

  // Feedback State
  let selectedFoodRating = 5;
  let selectedRobotRating = 5;
  let selectedTags = new Set(["🚀 Fast Robot Delivery", "🍱 Hot & Fresh Food"]);

  // Cache DOM Elements
  const tableNumberBadges = document.querySelectorAll(".current-table-num");
  const tableTitleElem = document.getElementById("tableTitle");
  const categoryTabsContainer = document.getElementById("categoryTabs");
  const menuGridContainer = document.getElementById("menuGrid");
  const searchInput = document.getElementById("searchInput");
  
  const cartItemsScroll = document.getElementById("cartItemsScroll");
  const cartSubtotalElem = document.getElementById("cartSubtotal");
  const cartTaxElem = document.getElementById("cartTax");
  const cartTotalElem = document.getElementById("cartTotal");
  const cartBadgeCount = document.getElementById("cartBadgeCount");
  const customerNameInput = document.getElementById("customerNameInput");
  const specialNoteInput = document.getElementById("specialNoteInput");
  const btnPlaceOrder = document.getElementById("btnPlaceOrder");

  const liveTrackerContainer = document.getElementById("liveTrackerContainer");
  const modalConfirmation = document.getElementById("modalConfirmation");
  const btnCloseModal = document.getElementById("btnCloseModal");

  // Feedback Modal Elements
  const modalFeedback = document.getElementById("modalFeedback");
  const btnSubmitFeedback = document.getElementById("btnSubmitFeedback");
  const btnSkipFeedback = document.getElementById("btnSkipFeedback");
  const feedbackCommentInput = document.getElementById("feedbackCommentInput");

  // Update Table Titles & Badges
  tableNumberBadges.forEach((el) => (el.textContent = `Table ${currentTableId}`));
  if (tableTitleElem) {
    tableTitleElem.textContent = `Table ${currentTableId} Dining Menu`;
  }

  // --- 2. Category Tabs Rendering ---
  function renderCategories() {
    if (!categoryTabsContainer) return;
    categoryTabsContainer.innerHTML = MENU_CATEGORIES.map((cat) => `
      <button class="category-btn ${cat.id === activeCategory ? 'active' : ''}" data-category="${cat.id}">
        <span>${cat.icon}</span>
        <span>${cat.name}</span>
      </button>
    `).join("");

    categoryTabsContainer.querySelectorAll(".category-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.getAttribute("data-category");
        renderCategories();
        renderMenu();
      });
    });
  }

  // --- 3. Menu Grid Rendering ---
  function renderMenu() {
    if (!menuGridContainer) return;

    let filtered = MENU_ITEMS.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
      menuGridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-light);">
          <svg style="width: 48px; height: 48px; stroke: var(--wood-light); margin-bottom: 1rem;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p style="font-size: 1.1rem; font-weight: 600; color: var(--wood-dark);">No menu items found</p>
          <p style="font-size: 0.9rem;">Try selecting another category or clear your search term.</p>
        </div>
      `;
      return;
    }

    menuGridContainer.innerHTML = filtered.map((item) => {
      // Find current quantity in cart if any
      const existingInCart = cart.find((c) => c.id === item.id);
      const currentQty = existingInCart ? existingInCart.qty : 1;

      return `
        <div class="menu-item-card" id="item-${item.id}">
          <div class="item-image-box">
            <img src="${item.image}" alt="${item.name}" loading="lazy" />
            <span class="item-category-tag">${item.category.toUpperCase()}</span>
            <span class="item-diet-tag">${item.diet}</span>
          </div>
          <div class="item-content">
            <div class="item-title-row">
              <h4 class="item-title">${item.name}</h4>
              <span class="item-price">${RESTAURANT_CONFIG.currency}${item.price.toFixed(2)}</span>
            </div>
            <p class="item-desc">${item.desc}</p>
            <div class="item-action-row">
              <div class="qty-control">
                <button class="qty-btn btn-item-minus" data-id="${item.id}" aria-label="Decrease quantity">-</button>
                <span class="qty-val" id="qty-val-${item.id}">${currentQty}</span>
                <button class="qty-btn btn-item-plus" data-id="${item.id}" aria-label="Increase quantity">+</button>
              </div>
              <button class="btn btn-primary btn-sm btn-add-cart" data-id="${item.id}">
                <svg style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Attach card quantity events
    menuGridContainer.querySelectorAll(".btn-item-plus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.getAttribute("data-id");
        const qtyValElem = document.getElementById(`qty-val-${itemId}`);
        if (qtyValElem) {
          let val = parseInt(qtyValElem.textContent, 10) || 1;
          qtyValElem.textContent = ++val;
        }
      });
    });

    menuGridContainer.querySelectorAll(".btn-item-minus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.getAttribute("data-id");
        const qtyValElem = document.getElementById(`qty-val-${itemId}`);
        if (qtyValElem) {
          let val = parseInt(qtyValElem.textContent, 10) || 1;
          if (val > 1) qtyValElem.textContent = --val;
        }
      });
    });

    menuGridContainer.querySelectorAll(".btn-add-cart").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.getAttribute("data-id");
        const qtyValElem = document.getElementById(`qty-val-${itemId}`);
        const qty = qtyValElem ? parseInt(qtyValElem.textContent, 10) : 1;
        addToCart(itemId, qty);
      });
    });
  }

  // --- 4. Cart Logic ---
  function addToCart(itemId, qty) {
    const item = MENU_ITEMS.find((m) => m.id === itemId);
    if (!item) return;

    const existingIndex = cart.findIndex((c) => c.id === itemId);
    if (existingIndex > -1) {
      cart[existingIndex].qty += qty;
    } else {
      cart.push({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: qty,
        image: item.image
      });
    }

    renderCart();
    showToast(`Added ${qty}x ${item.name} to order`, "success");
  }

  function updateCartItemQty(itemId, newQty) {
    const itemIndex = cart.findIndex((c) => c.id === itemId);
    if (itemIndex > -1) {
      if (newQty <= 0) {
        cart.splice(itemIndex, 1);
      } else {
        cart[itemIndex].qty = newQty;
      }
      renderCart();
    }
  }

  function renderCart() {
    if (!cartItemsScroll) return;

    const totalItemCount = cart.reduce((sum, item) => sum + item.qty, 0);
    if (cartBadgeCount) {
      cartBadgeCount.textContent = totalItemCount;
      cartBadgeCount.style.display = totalItemCount > 0 ? "inline-flex" : "none";
    }

    if (cart.length === 0) {
      cartItemsScroll.innerHTML = `
        <div class="cart-empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <p style="font-weight: 700; color: var(--wood-dark); margin-bottom: 0.25rem;">Your order is empty</p>
          <p style="font-size: 0.85rem;">Select dishes from the menu to build your table order.</p>
        </div>
      `;
      if (cartSubtotalElem) cartSubtotalElem.textContent = `${RESTAURANT_CONFIG.currency}0.00`;
      if (cartTaxElem) cartTaxElem.textContent = `${RESTAURANT_CONFIG.currency}0.00`;
      if (cartTotalElem) cartTotalElem.textContent = `${RESTAURANT_CONFIG.currency}0.00`;
      if (btnPlaceOrder) btnPlaceOrder.disabled = true;
      return;
    }

    if (btnPlaceOrder) btnPlaceOrder.disabled = false;

    let subtotal = 0;

    cartItemsScroll.innerHTML = cart.map((item) => {
      const itemTotal = item.price * item.qty;
      subtotal += itemTotal;

      return `
        <div class="cart-item-row">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price-unit">${RESTAURANT_CONFIG.currency}${item.price.toFixed(2)} each</div>
          </div>
          <div class="qty-control" style="transform: scale(0.85);">
            <button class="qty-btn btn-cart-minus" data-id="${item.id}">-</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn btn-cart-plus" data-id="${item.id}">+</button>
          </div>
          <div class="cart-item-total">${RESTAURANT_CONFIG.currency}${itemTotal.toFixed(2)}</div>
          <button class="cart-item-remove" data-id="${item.id}" title="Remove item">
            <svg style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      `;
    }).join("");

    const tax = subtotal * 0.08; // 8% tax/service
    const total = subtotal + tax;

    if (cartSubtotalElem) cartSubtotalElem.textContent = `${RESTAURANT_CONFIG.currency}${subtotal.toFixed(2)}`;
    if (cartTaxElem) cartTaxElem.textContent = `${RESTAURANT_CONFIG.currency}${tax.toFixed(2)}`;
    if (cartTotalElem) cartTotalElem.textContent = `${RESTAURANT_CONFIG.currency}${total.toFixed(2)}`;

    // Update Mobile Sticky Cart Bar
    const mobileCartBar = document.getElementById("mobileStickyCartBar");
    const mobileCartCount = document.getElementById("mobileCartCount");
    const mobileCartTotal = document.getElementById("mobileCartTotal");
    if (mobileCartBar && mobileCartCount && mobileCartTotal) {
      if (totalItemCount > 0) {
        mobileCartBar.classList.add("show");
        mobileCartCount.textContent = `${totalItemCount} item${totalItemCount > 1 ? 's' : ''}`;
        mobileCartTotal.textContent = `${RESTAURANT_CONFIG.currency}${total.toFixed(2)}`;
      } else {
        mobileCartBar.classList.remove("show");
      }
    }

    // Attach cart item quantity buttons
    cartItemsScroll.querySelectorAll(".btn-cart-plus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = cart.find((c) => c.id === id);
        if (item) updateCartItemQty(id, item.qty + 1);
      });
    });

    cartItemsScroll.querySelectorAll(".btn-cart-minus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = cart.find((c) => c.id === id);
        if (item) updateCartItemQty(id, item.qty - 1);
      });
    });

    cartItemsScroll.querySelectorAll(".cart-item-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        updateCartItemQty(id, 0);
      });
    });
  }

  // --- 5. Place Order ---
  if (btnPlaceOrder) {
    btnPlaceOrder.addEventListener("click", () => {
      if (cart.length === 0) return;

      const customerName = customerNameInput ? customerNameInput.value.trim() : "";
      const specialNote = specialNoteInput ? specialNoteInput.value.trim() : "";

      let subtotal = 0;
      const orderItems = cart.map((c) => {
        subtotal += c.price * c.qty;
        return {
          id: c.id,
          name: c.name,
          price: c.price,
          qty: c.qty
        };
      });

      const tax = subtotal * 0.08;
      const total = subtotal + tax;

      // Submit to central store
      const newOrder = Store.createOrder({
        tableNumber: currentTableId,
        customerName: customerName || `Table ${currentTableId} Guest`,
        specialNote: specialNote || "No special requests",
        items: orderItems,
        subtotal: subtotal,
        tax: tax,
        total: total
      });

      // Clear local cart
      cart = [];
      renderCart();

      // Show confirmation modal
      if (modalConfirmation) {
        const modalOrderNum = document.getElementById("modalOrderNum");
        const modalTableNum = document.getElementById("modalTableNum");
        if (modalOrderNum) modalOrderNum.textContent = newOrder.orderNumber;
        if (modalTableNum) modalTableNum.textContent = `Table ${currentTableId}`;
        modalConfirmation.classList.add("show");
      }

      // Check tracker immediately
      checkActiveOrder();
    });
  }

  if (btnCloseModal && modalConfirmation) {
    btnCloseModal.addEventListener("click", () => {
      modalConfirmation.classList.remove("show");
    });
  }

  // --- 6. Live Order Status Tracker ---
  function checkActiveOrder() {
    const orders = Store.getOrders();
    const robot = Store.getRobotState();
    
    // Find the latest non-delivered or recently updated order for this table
    const tableOrders = orders.filter((o) => o.tableNumber === currentTableId);
    if (tableOrders.length === 0) {
      if (liveTrackerContainer) liveTrackerContainer.style.display = "none";
      return;
    }

    // Latest order
    activeOrder = tableOrders[0];

    // If order is delivered more than 20 minutes ago, hide tracker unless active
    if (activeOrder.status === "delivered" && (Date.now() - new Date(activeOrder.updatedAt).getTime() > 1200000)) {
      if (liveTrackerContainer) liveTrackerContainer.style.display = "none";
      return;
    }

    renderLiveTracker(activeOrder, robot);

    // Auto-prompt feedback modal if order just got delivered and hasn't been prompted yet
    if (activeOrder.status === "delivered" && feedbackPromptedForOrderId !== activeOrder.id) {
      feedbackPromptedForOrderId = activeOrder.id;
      setTimeout(() => {
        openFeedbackModal();
      }, 700);
    }
  }

  function renderLiveTracker(order, robot) {
    if (!liveTrackerContainer) return;
    liveTrackerContainer.style.display = "block";

    const stages = [
      { key: "new", label: "New Order", icon: "📝" },
      { key: "preparing", label: "Preparing", icon: "🍳" },
      { key: "ready", label: "Ready", icon: "🍱" },
      { key: "delivering", label: "Robot En Route", icon: "🤖" },
      { key: "delivered", label: "Delivered", icon: "🎉" }
    ];

    const statusOrderIndex = {
      new: 0,
      preparing: 1,
      ready: 2,
      delivering: 3,
      delivered: 4
    };

    const currentStageIndex = statusOrderIndex[order.status] ?? 0;

    liveTrackerContainer.innerHTML = `
      <div class="live-tracker-card">
        <div class="tracker-header">
          <div>
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--wood-primary); text-transform: uppercase;">
              Active Live Order Tracker
            </span>
            <h3 style="font-size: 1.3rem; margin-top: 0.2rem;">
              Order #${order.orderNumber} &bull; Table ${currentTableId}
            </h3>
          </div>
          <span class="badge badge-${order.status}">
            ● ${order.status.replace("_", " ")}
          </span>
        </div>

        <div class="tracker-steps">
          ${stages.map((stage, idx) => {
            let stateClass = "";
            if (idx < currentStageIndex) stateClass = "completed";
            else if (idx === currentStageIndex) stateClass = "active";

            return `
              <div class="tracker-step ${stateClass}">
                <div class="step-icon-bubble">
                  ${idx < currentStageIndex ? '✓' : stage.icon}
                </div>
                <div class="step-label">${stage.label}</div>
              </div>
            `;
          }).join("")}
        </div>

        ${robot.status === "at_table" && robot.targetTable === currentTableId ? `
          <div class="robot-arrival-banner">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 2rem;">🤖</span>
              <div>
                <strong style="color: #065F46; font-size: 1.05rem; display: block;">
                  WaiterBot Has Arrived at Table ${currentTableId}!
                </strong>
                <span style="font-size: 0.85rem; color: #047857;">
                  Please collect your freshly prepared dishes from the tray.
                </span>
              </div>
            </div>
            <button class="btn btn-success btn-sm btn-confirm-food-received" data-order="${order.id}">
              ✓ Food Received
            </button>
          </div>
        ` : order.status === "delivering" ? `
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius-md); padding: 0.85rem 1.25rem; display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.5rem; animation: pulse 1.5s infinite;">🤖</span>
            <div style="font-size: 0.9rem; color: #1E40AF;">
              <strong>WaiterBot is cruising to Table ${currentTableId}...</strong> Please remain seated.
            </div>
          </div>
        ` : order.status === "preparing" ? `
          <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: var(--radius-md); padding: 0.85rem 1.25rem; font-size: 0.88rem; color: #92400E;">
            👨‍🍳 Kitchen chef is handcrafting your order. We will load it onto WaiterBot soon!
          </div>
        ` : order.status === "delivered" ? `
          <div style="background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: var(--radius-md); padding: 0.85rem 1.25rem; font-size: 0.88rem; color: #374151; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
            <span>✨ Enjoy your meal! Thank you for dining with Autonomous WaiterBot.</span>
            <button class="btn btn-amber btn-sm btn-reopen-feedback" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
              ⭐ Rate Dining Experience
            </button>
          </div>
        ` : ''}
      </div>
    `;

    // Attach "Food Received" button listener
    const btnReceived = liveTrackerContainer.querySelector(".btn-confirm-food-received");
    if (btnReceived) {
      btnReceived.addEventListener("click", () => {
        const orderId = btnReceived.getAttribute("data-order");
        Store.updateOrderStatus(orderId, "delivered");
        Store.returnRobotHome();
        showToast("Food received! WaiterBot is returning to home dock.", "success");
        setTimeout(() => {
          openFeedbackModal();
        }, 500);
      });
    }

    const btnReopenFeedback = liveTrackerContainer.querySelector(".btn-reopen-feedback");
    if (btnReopenFeedback) {
      btnReopenFeedback.addEventListener("click", () => {
        openFeedbackModal();
      });
    }
  }

  // --- 7. Customer Feedback Modal Logic ---
  function setupFeedbackStars() {
    const foodStars = document.querySelectorAll("#foodStarRating .star-btn");
    const robotStars = document.querySelectorAll("#robotStarRating .star-btn");

    function updateStars(container, count) {
      container.forEach((btn) => {
        const val = parseInt(btn.getAttribute("data-val"), 10);
        if (val <= count) {
          btn.classList.add("active");
          btn.textContent = "★";
        } else {
          btn.classList.remove("active");
          btn.textContent = "☆";
        }
      });
    }

    foodStars.forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedFoodRating = parseInt(btn.getAttribute("data-val"), 10);
        updateStars(foodStars, selectedFoodRating);
      });
    });

    robotStars.forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedRobotRating = parseInt(btn.getAttribute("data-val"), 10);
        updateStars(robotStars, selectedRobotRating);
      });
    });

    // Chips selection
    const chips = document.querySelectorAll(".feedback-chip");
    chips.forEach((chip) => {
      const tag = chip.getAttribute("data-tag");
      if (selectedTags.has(tag)) chip.classList.add("selected");

      chip.addEventListener("click", () => {
        if (selectedTags.has(tag)) {
          selectedTags.delete(tag);
          chip.classList.remove("selected");
        } else {
          selectedTags.add(tag);
          chip.classList.add("selected");
        }
      });
    });
  }

  function openFeedbackModal() {
    if (modalFeedback) {
      modalFeedback.classList.add("show");
    }
  }

  function closeFeedbackModal() {
    if (modalFeedback) {
      modalFeedback.classList.remove("show");
    }
  }

  if (btnSkipFeedback) {
    btnSkipFeedback.addEventListener("click", closeFeedbackModal);
  }

  if (btnSubmitFeedback) {
    btnSubmitFeedback.addEventListener("click", () => {
      const comment = feedbackCommentInput ? feedbackCommentInput.value.trim() : "";
      const customerName = customerNameInput ? customerNameInput.value.trim() : `Table ${currentTableId} Guest`;

      Store.saveFeedback({
        tableNumber: currentTableId,
        customerName: customerName || `Table ${currentTableId} Guest`,
        foodRating: selectedFoodRating,
        robotRating: selectedRobotRating,
        tags: Array.from(selectedTags),
        comment: comment
      });

      closeFeedbackModal();
      showToast("Thank you for your valuable feedback! Enjoy your meal.", "success");
      renderTableReviews();
    });
  }

  // --- 8. Direct Review Button & Mobile Cart Toggle ---
  const btnOpenFeedbackDirect = document.getElementById("btnOpenFeedbackDirect");
  if (btnOpenFeedbackDirect) {
    btnOpenFeedbackDirect.addEventListener("click", () => {
      openFeedbackModal();
    });
  }

  const btnMobileToggleCart = document.getElementById("btnMobileToggleCart");
  const cartSidebar = document.getElementById("cartSidebar");
  if (btnMobileToggleCart && cartSidebar) {
    btnMobileToggleCart.addEventListener("click", () => {
      cartSidebar.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // --- 9. Search Input Listener ---
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderMenu();
    });
  }

  // --- 10. Table Reviews Renderer ---
  const tableAvgFoodRating = document.getElementById("tableAvgFoodRating");
  const tableAvgRobotRating = document.getElementById("tableAvgRobotRating");
  const tableTotalReviewsCount = document.getElementById("tableTotalReviewsCount");
  const tableFeedbackGrid = document.getElementById("tableFeedbackGrid");

  function renderTableReviews() {
    const stats = Store.getFeedbackStats();
    const feedbacks = Store.getFeedbacks();

    if (tableAvgFoodRating) tableAvgFoodRating.textContent = `${stats.avgFood} ⭐`;
    if (tableAvgRobotRating) tableAvgRobotRating.textContent = `${stats.avgRobot} 🤖`;
    if (tableTotalReviewsCount) tableTotalReviewsCount.textContent = `${stats.totalCount}`;

    if (!tableFeedbackGrid) return;

    if (feedbacks.length === 0) {
      tableFeedbackGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-light); background: var(--bg-surface); border: 1px dashed var(--wood-border); border-radius: var(--radius-lg);">
          <p style="font-weight: 600; color: var(--wood-dark);">No guest reviews yet</p>
          <p style="font-size: 0.85rem;">Be the first to review your food and WaiterBot service for Table ${currentTableId}!</p>
        </div>
      `;
      return;
    }

    tableFeedbackGrid.innerHTML = feedbacks.slice(0, 4).map((fb) => {
      const starsFood = "★".repeat(fb.foodRating || 5) + "☆".repeat(5 - (fb.foodRating || 5));
      const starsRobot = "★".repeat(fb.robotRating || 5) + "☆".repeat(5 - (fb.robotRating || 5));
      const isCurrentTable = fb.tableNumber === currentTableId;
      const dateStr = fb.createdAt ? new Date(fb.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recently';

      return `
        <div class="feedback-item-card" style="${isCurrentTable ? 'border-color: var(--wood-primary); background: var(--wood-hover);' : ''}">
          <div class="feedback-item-top">
            <div>
              <h4 style="font-size: 0.95rem; color: var(--wood-dark); margin-bottom: 0.15rem;">
                ${escapeHtml(fb.customerName || "Table Guest")}
                ${isCurrentTable ? '<span class="badge" style="background: var(--wood-primary); color: #fff; font-size: 0.65rem; margin-left: 0.3rem;">Your Table</span>' : ''}
              </h4>
              <span class="badge" style="background: ${isCurrentTable ? 'rgba(255,255,255,0.9)' : 'var(--bg-secondary)'}; color: var(--wood-dark); font-size: 0.72rem; padding: 0.15rem 0.5rem;">Table ${fb.tableNumber || 1}</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-light); font-weight: 600;">${dateStr}</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.65rem; background: var(--bg-surface); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--wood-soft); font-size: 0.8rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted); font-weight: 600;">🍱 Food Taste:</span>
              <span class="feedback-stars" style="font-size: 0.85rem;">${starsFood}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted); font-weight: 600;">🤖 WaiterBot:</span>
              <span class="feedback-stars" style="font-size: 0.85rem;">${starsRobot}</span>
            </div>
          </div>

          ${fb.tags && fb.tags.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.6rem;">
              ${fb.tags.map(tag => `<span class="badge" style="background: var(--bg-surface); color: var(--wood-primary); font-size: 0.7rem; padding: 0.15rem 0.4rem; border: 1px solid var(--wood-border);">${escapeHtml(tag)}</span>`).join("")}
            </div>
          ` : ''}

          ${fb.comment ? `
            <p style="font-size: 0.85rem; color: var(--text-main); font-style: italic; line-height: 1.4; margin-top: auto; padding-top: 0.4rem; border-top: 1px dashed var(--wood-soft);">
              "${escapeHtml(fb.comment)}"
            </p>
          ` : ''}
        </div>
      `;
    }).join("");
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

  // --- 11. Real-time Store Updates Listener ---
  Store.subscribe((event) => {
    checkActiveOrder();
    if (event.key === "waiterbot_feedbacks" || event.action === "FEEDBACK_SUBMITTED" || event.action === "SUPABASE_FETCH" || event.action === "DATA_RESET") {
      renderTableReviews();
    }
  });

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

  // Initial Setup
  setupFeedbackStars();
  renderCategories();
  renderMenu();
  renderCart();
  checkActiveOrder();
  renderTableReviews();
});
