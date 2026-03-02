export type WaterfallPoint = { step: string; value: number };

export type AnalyticsSeries = Record<string, string | number>;

export type QuoteLine = {
  quote_line_id: string;
  sku: string;
  quantity: number;
  list_price: number;
  discount_percent: number;
  cost: number;
  dynamic_fields: Record<string, unknown>;
};

export type QuoteRequest = {
  header: {
    quote_id: string;
    customer_id: string;
    customer_name: string;
    customer_segment: string;
    header_fields: Record<string, unknown>;
  };
  line_items: QuoteLine[];
  formulas: { target_field: string; expression: string }[];
};

export type QuoteListItem = {
  id: string;
  description: string;
  customerName: string;
  dateCreated: string;
  dateModified: string;
  totalValue: number;
  lineItemCount: number;
  status: string;
};

export type PricingLineItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  listPrice: number;
  cost: number;
  volumeDiscount: number;
  rebate: number;
  netPrice: number;
  margin: number;
  totalValue: number;
  showAnalytics?: boolean;
  [key: string]: unknown;
};

export type QuoteDetail = {
  id: string;
  description: string;
  customerName: string;
  customerId: string;
  customerSegment: string;
  productHierarchy: string;
  salesOrg: string;
  region: string;
  country: string;
  currency: string;
  priceList: string;
  validityDate: string;
  paymentTerms: string;
  lineItems: PricingLineItem[];
  totalValue: number;
  lineItemCount: number;
  dateCreated: string;
  dateModified: string;
};

export type LineItemColumnKey = string;

export type TenantLineItemColumnConfig = {
  key: LineItemColumnKey;
  label: string;
  visible: boolean;
  mandatory: boolean;
  editable: boolean;
  sortOrder: number;
  isCalculated: boolean;
  formula: string;
};

export type TenantLineItemConfig = {
  tenantId: string;
  columns: TenantLineItemColumnConfig[];
};

export type MasterProduct = {
  product_id: string;
  sku: string;
  name: string;
  description?: string;
  family?: string;
  category?: string;
  price?: number;
  active?: boolean;
};

export type MasterCustomer = {
  customer_id: string;
  account_number?: string;
  name: string;
  segment?: string;
  region?: string;
  industry?: string;
  active?: boolean;
};
