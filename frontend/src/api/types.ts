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
  fieldType?: string;
  defaultValue?: string | number | boolean | null;
  width?: number | null;
  options?: string[];
  validation?: Record<string, unknown>;
  description?: string;
  category?: string;
};

export type TenantLineItemConfig = {
  tenantId: string;
  columns: TenantLineItemColumnConfig[];
};

export type FieldLogicValidationResult = {
  validationId: string;
  status: 'valid' | 'invalid';
  severity: 'info' | 'warning' | 'error';
  errors: Array<{ type?: string; message: string; suggestion?: string }>;
  warnings: Array<{ type?: string; message: string; suggestion?: string }>;
  dependencies: { tables: string[]; columns: string[] };
  generatedCode: string;
};

export type FieldLogicRule = {
  logicId: string;
  tenantId: string;
  scope: string;
  fieldKey: string;
  logicText: string;
  generatedCode: string;
  explanation: string;
  dependencies: Record<string, unknown>;
  version: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AIPricingProcessResult = {
  configId: string;
  tenantId: string;
  status: string;
  summary: string;
  confidence: number;
  processedResult: Record<string, unknown>;
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

export type AuthLoginResponse = {
  success: boolean;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    refresh_expires_in: number;
    tenant_id: string;
    roles: string[];
    user: { user_id: string; email: string; full_name?: string };
  };
};

export type AuthMeResponse = {
  success: boolean;
  data: {
    user_id: string;
    tenant_id: string;
    roles: string[];
    permissions: string[];
  };
};

export type AuthTenantsResponse = {
  success: boolean;
  data: Array<{ tenant_id: string; tenant_name: string }>;
};

export type AuditLog = {
  log_id: string;
  actor_user_id: string;
  actor_tenant_id: string;
  actor_name?: string;
  actor_tenant_name?: string;
  target_type: string;
  target_id: string;
  target_name?: string;
  action: string;
  detail: any;
  created_at_epoch: number;
};
