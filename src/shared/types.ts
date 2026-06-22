export type Region = "North" | "South" | "East" | "West";
export type Category = "Electronics" | "Apparel" | "Home & Kitchen";
export type Segment = "Enterprise" | "SMB" | "Consumer";

export interface Product {
  productId: string;
  name: string;
  category: Category;
  unitCost: number;
}

export interface Order {
  orderId: string;
  date: string; // ISO date string, e.g. "2024-07-03"
  customerId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  region: Region;
}

export interface Customer {
  customerId: string;
  name: string;
  segment: Segment;
}
