/**
 * Autonomes WaiterBot - Sample Menu Database & Restaurant Configuration
 * System designed for in-home and cafe automated robot waiter service
 * Currency: Sri Lankan Rupees (Rs. / LKR)
 */

const RESTAURANT_CONFIG = {
  name: "Autonomes Cafe & Dining",
  robotName: "Autonomes WaiterBot",
  tagline: "Smart Autonomous Dining Experience",
  totalTables: 4,
  currency: "Rs. ",
  staffPin: "1234",
  tableCoordinates: {
    // Relative coordinates (%) on the 2D floorplan radar map
    0: { name: "Home Dock / Kitchen", x: 12, y: 50 },
    1: { name: "Table 1 (Window Side)", x: 42, y: 24 },
    2: { name: "Table 2 (Terrace View)", x: 82, y: 24 },
    3: { name: "Table 3 (Central Booth)", x: 42, y: 76 },
    4: { name: "Table 4 (Garden Lounge)", x: 82, y: 76 }
  }
};

const SUPABASE_CONFIG = {
  url: "https://aibsedpwlfpclbqzgtqg.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpYnNlZHB3bGZwY2xicXpndHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MDA2OTYsImV4cCI6MjEwNDI3NjY5Nn0.GhFHCXcZkoofzSIcsv4btuBUVtH0QBthEzdwg750fJ4",
  enabled: true
};

const MENU_CATEGORIES = [
  { id: "all", name: "All Items", icon: "✨" },
  { id: "rice", name: "Rice Dishes", icon: "🍚" },
  { id: "noodles", name: "Artisan Noodles", icon: "🍜" },
  { id: "drinks", name: "Beverages", icon: "🍹" },
  { id: "desserts", name: "Desserts", icon: "🍰" }
];

const MENU_ITEMS = [
  // --- RICE DISHES ---
  {
    id: "r1",
    name: "Truffle Wild Mushroom Fried Rice",
    category: "rice",
    price: 1850.00,
    desc: "Wok-seared Jasmine rice infused with black truffle butter, shiitake mushrooms, scallions, and a golden poached egg.",
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80",
    diet: "Vegetarian",
    prepTime: "8-10 mins",
    popular: true
  },
  {
    id: "r2",
    name: "Garlic Butter Hibachi Steak Rice",
    category: "rice",
    price: 2450.00,
    desc: "Tender cubed sirloin steak flash-fried in garlic soy glaze over Japanese short-grain rice with toasted sesame.",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
    diet: "Chef Special",
    prepTime: "10-12 mins",
    popular: true
  },
  {
    id: "r3",
    name: "Honey Teriyaki Salmon Bowl",
    category: "rice",
    price: 2250.00,
    desc: "Pan-roasted Atlantic salmon fillet glazed in sweet teriyaki, served with edamame, pickled ginger, and sushi rice.",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
    diet: "Pescatarian",
    prepTime: "10 mins",
    popular: false
  },
  {
    id: "r4",
    name: "Szechuan Spicy Kimchi Jasmine Rice",
    category: "rice",
    price: 1650.00,
    desc: "Fiery wok-tossed rice with aged house kimchi, crispy tofu cubes, nori strips, and roasted chili oil.",
    image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80",
    diet: "Spicy",
    prepTime: "7 mins",
    popular: false
  },

  // --- NOODLES ---
  {
    id: "n1",
    name: "Artisan Tonkotsu Smoked Ramen",
    category: "noodles",
    price: 2150.00,
    desc: "Rich 12-hour simmered bone broth, hand-pulled noodles, slow-braised chashu pork belly, bamboo shoots, and ajitsuke tamago.",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80",
    diet: "Signature",
    prepTime: "9 mins",
    popular: true
  },
  {
    id: "n2",
    name: "Creamy Chili Crisp Carbonara Udon",
    category: "noodles",
    price: 1950.00,
    desc: "Thick chewy udon noodles tossed in a velvety egg-yolk and pecorino cream sauce, topped with crunchy garlic chili oil and scallions.",
    image: "https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?auto=format&fit=crop&w=600&q=80",
    diet: "Fusion",
    prepTime: "8 mins",
    popular: true
  },
  {
    id: "n3",
    name: "Bangkok Street Pad Thai Supreme",
    category: "noodles",
    price: 1850.00,
    desc: "Stir-fried flat rice noodles with tiger prawns, crispy pressed tofu, bean sprouts, crushed peanuts, and fresh lime.",
    image: "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=600&q=80",
    diet: "Gluten-Free",
    prepTime: "8 mins",
    popular: false
  },
  {
    id: "n4",
    name: "Smoky Wok Angus Beef Chow Fun",
    category: "noodles",
    price: 2100.00,
    desc: "Wide rice noodles charred in high-heat wok hei with marinated Angus beef slices, yellow chives, and premium dark soy sauce.",
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80",
    diet: "Chef Pick",
    prepTime: "7 mins",
    popular: false
  },

  // --- DRINKS ---
  {
    id: "d1",
    name: "Nitro Cold Brew Vanilla Latte",
    category: "drinks",
    price: 850.00,
    desc: "Smooth nitrogen-infused Ethiopian single origin coffee with Madagascar vanilla bean cream and silky microfoam.",
    image: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80",
    diet: "Iced",
    prepTime: "2 mins",
    popular: true
  },
  {
    id: "d2",
    name: "Sparkling Lychee Dragonfruit Soda",
    category: "drinks",
    price: 750.00,
    desc: "Handcrafted fruit soda with ruby dragonfruit pureé, sweet lychee boba, fresh mint leaves, and effervescent bubbles.",
    image: "https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=600&q=80",
    diet: "Refreshing",
    prepTime: "2 mins",
    popular: true
  },
  {
    id: "d3",
    name: "Iced Jasmine Peach Blossom Green Tea",
    category: "drinks",
    price: 680.00,
    desc: "Cold-brewed organic jasmine blossoms infused with white peach juice, aloe vera jelly, and a touch of wild honey.",
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80",
    diet: "Herbal",
    prepTime: "2 mins",
    popular: false
  },
  {
    id: "d4",
    name: "Golden Cardamom Masala Chai",
    category: "drinks",
    price: 650.00,
    desc: "Slow-brewed Ceylon & Assam tea simmered with fresh ginger, cracked cardamom pods, cinnamon bark, and steamed milk.",
    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
    diet: "Warm & Cozy",
    prepTime: "3 mins",
    popular: false
  },

  // --- DESSERTS ---
  {
    id: "s1",
    name: "Matcha Molten Lava Cake",
    category: "desserts",
    price: 1150.00,
    desc: "Warm Uji ceremonial green tea cake with an oozing white chocolate matcha center, paired with Madagascar vanilla gelato.",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80",
    diet: "Bestseller",
    prepTime: "6 mins",
    popular: true
  },
  {
    id: "s2",
    name: "San Sebastián Basque Burnt Cheesecake",
    category: "desserts",
    price: 1050.00,
    desc: "Caramelized crust with an ultra-creamy, melt-in-your-mouth custard core, served with fresh raspberry coulis.",
    image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80",
    diet: "Classic",
    prepTime: "3 mins",
    popular: true
  },
  {
    id: "s3",
    name: "Warm Coconut Mango Sticky Rice",
    category: "desserts",
    price: 950.00,
    desc: "Sweet glutinous rice cooked in rich coconut milk, topped with sliced golden mangoes and toasted sesame seeds.",
    image: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=600&q=80",
    diet: "Vegan",
    prepTime: "4 mins",
    popular: false
  },
  {
    id: "s4",
    name: "70% Dark Chocolate Hazelnut Fondant",
    category: "desserts",
    price: 1200.00,
    desc: "Decadent Belgian dark chocolate souffle with a roasted hazelnut praline heart and sea salt flakes.",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80",
    diet: "Rich",
    prepTime: "6 mins",
    popular: false
  }
];
