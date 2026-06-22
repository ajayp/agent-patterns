import type { Customer, Order, Product } from "./types.js";

export const products: Product[] = [
  { productId: "P001", name: "Wireless Headphones Pro", category: "Electronics", unitCost: 45 },
  { productId: "P002", name: "4K Webcam", category: "Electronics", unitCost: 30 },
  { productId: "P003", name: "Mechanical Keyboard", category: "Electronics", unitCost: 55 },
  { productId: "P004", name: "Running Jacket", category: "Apparel", unitCost: 28 },
  { productId: "P005", name: "Merino Wool Hoodie", category: "Apparel", unitCost: 22 },
  { productId: "P006", name: "Performance Leggings", category: "Apparel", unitCost: 18 },
  { productId: "P007", name: "Cast Iron Skillet", category: "Home & Kitchen", unitCost: 25 },
  { productId: "P008", name: "Bamboo Cutting Board Set", category: "Home & Kitchen", unitCost: 12 },
];

export const customers: Customer[] = [
  { customerId: "C001", name: "Apex Solutions", segment: "Enterprise" },
  { customerId: "C002", name: "Bright Digital", segment: "SMB" },
  { customerId: "C003", name: "Jordan Lee", segment: "Consumer" },
  { customerId: "C004", name: "CoreTech Inc", segment: "Enterprise" },
  { customerId: "C005", name: "Summit Retail", segment: "SMB" },
  { customerId: "C006", name: "Taylor Kim", segment: "Consumer" },
  { customerId: "C007", name: "Vertex Group", segment: "Enterprise" },
  { customerId: "C008", name: "Maple & Co", segment: "SMB" },
  { customerId: "C009", name: "Riley Chen", segment: "Consumer" },
  { customerId: "C010", name: "Nova Commerce", segment: "SMB" },
];

export const orders: Order[] = [
  { orderId: "O001", date: "2024-07-03", customerId: "C001", productId: "P001", quantity: 12, unitPrice: 129, region: "North" },
  { orderId: "O002", date: "2024-07-08", customerId: "C003", productId: "P004", quantity: 2,  unitPrice: 89,  region: "West"  },
  { orderId: "O003", date: "2024-07-11", customerId: "C004", productId: "P002", quantity: 8,  unitPrice: 89,  region: "South" },
  { orderId: "O004", date: "2024-07-15", customerId: "C002", productId: "P007", quantity: 5,  unitPrice: 49,  region: "East"  },
  { orderId: "O005", date: "2024-07-18", customerId: "C005", productId: "P003", quantity: 6,  unitPrice: 149, region: "North" },
  { orderId: "O006", date: "2024-07-22", customerId: "C006", productId: "P005", quantity: 3,  unitPrice: 65,  region: "West"  },
  { orderId: "O007", date: "2024-07-25", customerId: "C007", productId: "P001", quantity: 20, unitPrice: 125, region: "South" },
  { orderId: "O008", date: "2024-07-29", customerId: "C008", productId: "P008", quantity: 10, unitPrice: 35,  region: "East"  },
  { orderId: "O009", date: "2024-08-02", customerId: "C001", productId: "P003", quantity: 15, unitPrice: 145, region: "North" },
  { orderId: "O010", date: "2024-08-06", customerId: "C009", productId: "P006", quantity: 4,  unitPrice: 55,  region: "South" },
  { orderId: "O011", date: "2024-08-09", customerId: "C004", productId: "P001", quantity: 10, unitPrice: 129, region: "West"  },
  { orderId: "O012", date: "2024-08-13", customerId: "C010", productId: "P007", quantity: 8,  unitPrice: 49,  region: "North" },
  { orderId: "O013", date: "2024-08-16", customerId: "C002", productId: "P002", quantity: 6,  unitPrice: 89,  region: "East"  },
  { orderId: "O014", date: "2024-08-20", customerId: "C003", productId: "P004", quantity: 3,  unitPrice: 89,  region: "West"  },
  { orderId: "O015", date: "2024-08-23", customerId: "C005", productId: "P005", quantity: 7,  unitPrice: 65,  region: "South" },
  { orderId: "O016", date: "2024-08-27", customerId: "C007", productId: "P003", quantity: 12, unitPrice: 149, region: "North" },
  { orderId: "O017", date: "2024-09-03", customerId: "C006", productId: "P008", quantity: 6,  unitPrice: 35,  region: "East"  },
  { orderId: "O018", date: "2024-09-07", customerId: "C001", productId: "P001", quantity: 18, unitPrice: 125, region: "South" },
  { orderId: "O019", date: "2024-09-10", customerId: "C010", productId: "P006", quantity: 9,  unitPrice: 55,  region: "West"  },
  { orderId: "O020", date: "2024-09-14", customerId: "C004", productId: "P002", quantity: 10, unitPrice: 89,  region: "North" },
  { orderId: "O021", date: "2024-09-17", customerId: "C008", productId: "P007", quantity: 4,  unitPrice: 49,  region: "East"  },
  { orderId: "O022", date: "2024-09-21", customerId: "C003", productId: "P005", quantity: 5,  unitPrice: 65,  region: "South" },
  { orderId: "O023", date: "2024-09-24", customerId: "C009", productId: "P004", quantity: 2,  unitPrice: 89,  region: "West"  },
  { orderId: "O024", date: "2024-09-27", customerId: "C002", productId: "P003", quantity: 8,  unitPrice: 149, region: "North" },
  { orderId: "O025", date: "2024-09-30", customerId: "C007", productId: "P001", quantity: 25, unitPrice: 129, region: "South" },
];

export const datasetContext = JSON.stringify({ products, orders, customers }, null, 2);
