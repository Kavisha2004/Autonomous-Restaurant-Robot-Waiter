# 🤖 Autonomes WaiterBot - Smart Restaurant & Robot Waiter System

A responsive, autonomous in-home & cafe restaurant waiter robot ordering website built using pure **HTML5, CSS3, and JavaScript**. Engineered as a capstone demo for Automation and Robotics Engineering projects.

---

## 🇱🇰 Currency Configuration

- **Currency**: **Sri Lankan Rupees (`Rs.` / `LKR`)**
- **Sample Pricing**:
  - Rice Dishes: `Rs. 1,650.00` – `Rs. 2,450.00`
  - Artisan Noodles: `Rs. 1,850.00` – `Rs. 2,150.00`
  - Beverages: `Rs. 650.00` – `Rs. 850.00`
  - Desserts: `Rs. 950.00` – `Rs. 1,200.00`

---

## ☁️ Supabase Cloud Database & Live Realtime Sync

This system is fully integrated with **Supabase** for multi-device live synchronization across different phones, tablets, and laptops over the web.

### 1. Database Schema Setup
To activate the cloud database tables and Realtime channels in your Supabase project:
1. Open your **[Supabase Dashboard](https://supabase.com/dashboard)** $\rightarrow$ your project (`aibsedpwlfpclbqzgtqg`).
2. Go to **SQL Editor** on the left menu.
3. Open or copy the contents of [`supabase_schema.sql`](supabase_schema.sql).
4. Paste and click **Run**.

This will automatically create:
- `orders` (live customer table orders, item breakdown, and timeline history)
- `tables_status` (real-time 4-table status tracking)
- `robot_state` (telemetry, live position coordinates, battery, logs)
- `feedbacks` (customer food & robot 5-star ratings and reviews)
- Realtime publications & Row Level Security (RLS) policies.

---

## 🚀 Quick Start / How to Run Locally

### Option 1: Double-Click
Open `index.html` directly in any modern web browser (Chrome, Edge, Firefox, Safari).

### Option 2: Local HTTP Server
Run a local static server for optimal cross-tab synchronization:
```bash
python -m http.server 3000
```
Then navigate to `http://localhost:3000`.

---

## 🍽️ Restaurant Architecture & Unique Table Links

The restaurant setup features **4 tables**, each configured with a dedicated unique QR code link that auto-detects the table number:

| Table | Direct URL | Dining Area |
|---|---|---|
| **Table 1** | [`/table.html?table=1`](table.html?table=1) | Window Side Dining Area |
| **Table 2** | [`/table.html?table=2`](table.html?table=2) | Terrace View Table |
| **Table 3** | [`/table.html?table=3`](table.html?table=3) | Central Cozy Booth |
| **Table 4** | [`/table.html?table=4`](table.html?table=4) | Garden Lounge Area |

---

## 👨‍🍳 Staff Access & Security Gate

- **Kitchen Dashboard URL**: [`/kitchen.html`](kitchen.html)
- **Role Isolation**: Customers dining at tables cannot navigate to or access the kitchen control panel.
- **Default Staff PIN**: `1234` (configurable in `js/data.js`).

---

## 📋 Features Overview

### 1. Customer Table Ordering Interface (`table.html`)
- **Auto Table Detection**: Reads `?table=1` to `?table=4` from URL query parameters.
- **Rich Menu Catalog**: Categorized into **Rice**, **Noodles**, **Drinks**, and **Desserts** with appetizing descriptions, dietary badges, and Sri Lankan Rupee (`Rs.`) price tags.
- **Interactive Controls**: Instant search bar, category filter tabs, and quantity steppers (`+` / `-`).
- **Cart & Order Customization**: Real-time subtotal/tax calculations in `Rs.`, Customer Name, and Allergy/Special cooking instructions field.
- **Live Order Progress Tracker**: Real-time 5-stage progress indicator:
  1. *New Order*
  2. *Kitchen Preparing*
  3. *Food Ready*
  4. *Robot En Route to Table*
  5. *Delivered / Meal Enjoyment*
- **Food Arrival Notification**: Interactive "I Have Received My Food" button that alerts staff and triggers the robot to return to base.
- **⭐ End-of-Process Customer Feedback Modal**:
  - 5-Star Food & Beverage Quality rating.
  - 5-Star WaiterBot Delivery & Navigation rating.
  - Quick highlight chips (`🚀 Fast Robot Delivery`, `🍱 Hot & Fresh Food`, `🤖 Loved the Robot`, `✨ Smooth Navigation`, `👌 Great Taste`).
  - Comments / Suggestions text box.

### 2. Kitchen Staff Dashboard (`kitchen.html`)
- **Real-Time Order Queue**: Automatically receives orders with table number, order ID, items list, customer name, total amount in `Rs.`, and special notes callout.
- **Workflow Action Buttons**:
  - `Start Preparing`: Updates status to cooking.
  - `Mark Ready for Delivery`: Indicates food is boxed and ready for loading.
  - `Send WaiterBot to Table X`: Dispatches autonomous navigation to target table.
  - `Mark Delivered & Received`: Completes order and docks robot.
- **4-Table Status Overview**: Live status cards for Tables 1 to 4 (`Empty`, `New Order`, `Cooking`, `Waiting Delivery`, `Delivered`).
- **Live Customer Feedback & Reviews Monitor**: Displays live star ratings (Food & Robot), total review counts, and recent guest reviews with badges and comments.
- **Real-Time Sound Synthesis**: Built-in Web Audio API chimes for order placement, robot arrival, and emergency sirens (zero external audio files needed).

### 3. Robot Command & 2D Floorplan Radar (`kitchen.html`)
- **2D Radar Floor Navigation**: Visual floorplan showing Kitchen Dock, corridors, and Tables 1 to 4 with an animated Robot avatar moving along coordinates in real time.
- **Live Telemetry Gauges**:
  - Robot state (`IDLE`, `IN_TRANSIT`, `AT_TABLE`, `RETURNING`, `EMERGENCY_STOPPED`).
  - Active target table & Order payload.
  - Battery percentage meter with dynamic color feedback.
  - Obstacle / Ultrasonic barrier sensor status.
- **Manual Control Center**:
  - Direct dispatch to Tables 1, 2, 3, or 4.
  - Return to Dock station.
  - Ultrasonic barrier toggle simulation.
  - Instant **Emergency Stop** halt trigger with siren alert.
- **Live Telemetry Event Log Stream**: Real-time timestamped event stream.

---

## 🌐 Free Hosting Deployment

This website is 100% client-side compatible (HTML, CSS, JS, LocalStorage) and can be hosted for free on:
- **GitHub Pages**: Push repository and enable Pages in repository settings.
- **Netlify**: Drag and drop project folder into Netlify Drop.
- **Vercel**: Deploy with static preset.
- **Cloudflare Pages / Surge.sh / Firebase Hosting**.

---

## 📁 File Structure

```
antigravity website/
├── index.html          # Hub portal, Table links selector, project overview, staff login gate
├── table.html          # Customer ordering interface with table detection, live tracker & feedback
├── kitchen.html        # Kitchen staff dashboard, robot control & customer reviews monitor
├── README.md           # Documentation and setup guide
├── css/
│   └── style.css       # Design system (cafe warm wood/white theme, star ratings, radar layout)
└── js/
    ├── data.js         # Menu database (Rice, Noodles, Drinks, Desserts in Rs.) & configuration
    ├── store.js        # State manager (LocalStorage + BroadcastChannel sync, feedback CRUD, audio)
    ├── table.js        # Customer ordering logic, cart drawer, live tracker & feedback modal
    └── kitchen.js      # Kitchen queue manager, 4-table monitor, robot navigation & reviews display
```
