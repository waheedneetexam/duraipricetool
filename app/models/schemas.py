from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class CSVColumnMapping(BaseModel):
    transaction_date: str = "transaction_date"
    sku: str = "sku"
    product_family: str = "product_family"
    customer_id: str = "customer_id"
    customer_name: str = "customer_name"
    customer_segment: str = "customer_segment"
    region: str = "region"
    list_price: str = "list_price"
    discount_percent: str = "discount_percent"
    net_price: str = "net_price"
    cost: str = "cost"
    quantity: str = "quantity"
    quote_id: str = "quote_id"
    sales_rep: str = "sales_rep"
    currency: str = "currency"


class FormulaDefinition(BaseModel):
    target_field: str
    expression: str


class QuoteLineItem(BaseModel):
    quote_line_id: str
    sku: str
    quantity: int = 1
    list_price: float
    discount_percent: float = 0.0
    cost: float
    dynamic_fields: dict[str, Any] = Field(default_factory=dict)


class QuoteHeader(BaseModel):
    quote_id: str
    customer_id: str
    customer_name: str
    customer_segment: str
    header_fields: dict[str, Any] = Field(default_factory=dict)


class QuoteCalculationRequest(BaseModel):
    header: QuoteHeader
    line_items: list[QuoteLineItem]
    formulas: list[FormulaDefinition] = Field(default_factory=list)


class QuoteCalculationResponse(BaseModel):
    quote_id: str
    status: str
    totals: dict[str, float]
    line_items: list[dict[str, Any]]
    embedded_analytics: dict[str, Any]


class WorkflowEvaluationRequest(BaseModel):
    quote_id: str
    customer_id: str
    customer_segment: str
    discount_percent: float
    current_state: str
    requested_state: str


class WorkflowEvaluationResponse(BaseModel):
    allowed: bool
    next_state: str
    required_approver_role: str | None = None
    reason: str


class AnalyticsFilter(BaseModel):
    date_from: date | None = None
    date_to: date | None = None
    customer_segment: str | None = None
    sku: str | None = None


class ChatRequest(BaseModel):
    question: str


class QuoteSaveLineItem(BaseModel):
    id: str
    productName: str
    sku: str
    quantity: float
    listPrice: float
    cost: float
    volumeDiscount: float = 0.0
    rebate: float = 0.0
    dynamic_fields: dict[str, Any] = Field(default_factory=dict)


class QuoteSaveRequest(BaseModel):
    id: str | None = None
    description: str = ""
    customerName: str = ""
    customerId: str = ""
    customerSegment: str = ""
    productHierarchy: str = ""
    salesOrg: str = ""
    region: str = ""
    country: str = ""
    currency: str = "USD"
    priceList: str = ""
    validityDate: str = ""
    paymentTerms: str = ""
    lineItems: list[QuoteSaveLineItem] = Field(default_factory=list)


class LineItemColumnConfig(BaseModel):
    key: str
    label: str = ""
    visible: bool = True
    mandatory: bool = False
    editable: bool = True
    is_calculated: bool = False
    formula: str = ""
    field_type: str = "text"
    default_value: str | None = None
    width: int | None = None
    options: list[str] = Field(default_factory=list)
    validation: dict[str, Any] = Field(default_factory=dict)
    description: str = ""
    category: str = ""


class LineItemColumnConfigSaveRequest(BaseModel):
    columns: list[LineItemColumnConfig] = Field(default_factory=list)


class FieldLogicValidateRequest(BaseModel):
    tenant_id: str = "default"
    scope: str = "line_item"
    field_key: str
    logic_text: str


class FieldLogicSaveRequest(BaseModel):
    tenant_id: str = "default"
    scope: str = "line_item"
    field_key: str
    logic_text: str
    generated_code: str = ""
    explanation: str = ""
    dependencies: dict[str, Any] = Field(default_factory=dict)


class AIPricingTemplateProcessRequest(BaseModel):
    tenant_id: str = "default"
    template_text: str


class DataManagementImportRequest(BaseModel):
    data: list[dict[str, Any]] = Field(default_factory=list)
    update_duplicates: bool = True


class DataManagementRecordPayload(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)


class DataManagementBulkDeleteRequest(BaseModel):
    ids: list[str] = Field(default_factory=list)


class AuthLoginRequest(BaseModel):
    email: str
    password: str
    tenant_id: str = "default"


class AuthRefreshRequest(BaseModel):
    refresh_token: str
