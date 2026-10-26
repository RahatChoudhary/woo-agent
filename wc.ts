import "dotenv/config";
import WooCommerceRestApiPkg from "@woocommerce/woocommerce-rest-api";

// CommonJS package: under ESM the class sits on .default
const WooCommerceRestApi = (WooCommerceRestApiPkg as any).default ?? WooCommerceRestApiPkg;

export const wc = new WooCommerceRestApi({
  url: process.env.WC_URL!,
  consumerKey: process.env.WC_KEY!,
  consumerSecret: process.env.WC_SECRET!,
  version: "wc/v3",
});

export async function getAll(endpoint: string, params: Record<string, unknown> = {}) {
  const all: any[] = [];
  for (let page = 1; page <= 10; page++) { // safety cap: 1,000 records
    const res = await wc.get(endpoint, { ...params, per_page: 100, page });
    all.push(...res.data);
    const totalPages = Number(res.headers["x-wp-totalpages"] ?? 1);
    if (page >= totalPages) break;
  }
  return all;
}

export async function getLowStockProducts(threshold = 5) {
  const products = await getAll("products", { status: "publish" });
  return products
  .filter((p: any) => p.manage_stock && p.stock_quantity !== null && p.stock_quantity <= threshold)
  .map((p: any) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock_quantity, price: p.price }));
}

export async function listOrders(status?: string, limit = 20) {
  const params: Record<string, unknown> = { per_page: limit };
  if (status) params.status = status;
  const res = await wc.get("orders", params);
  return res.data.map((o: any) => ({
    id: o.id,
    status: o.status,
    total: `${o.total} ${o.currency}`,
    customer: `${o.billing.first_name} ${o.billing.last_name}`.trim(),
    created: o.date_created,
    items: o.line_items.map((i: any) => `${i.quantity} x ${i.name}`),
  }));
}

export async function getOrder(id: number) {
  const { data: o } = await wc.get(`orders/${id}`);
  return {
    id: o.id,
    status: o.status,
    total: `${o.total} ${o.currency}`,
    customer: `${o.billing.first_name} ${o.billing.last_name}`.trim(),
    email: o.billing.email,
    created: o.date_created,
    payment: o.payment_method_title,
    items: o.line_items.map((i: any) => ({ name: i.name, qty: i.quantity, total: i.total })),
    customer_note: o.customer_note,
  };
}