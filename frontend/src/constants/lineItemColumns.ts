export type LineItemColumnKey = string;

export type LineItemColumnConfig = {
  key: LineItemColumnKey;
  label: string;
  visible: boolean;
  mandatory: boolean;
  editable: boolean;
  isCalculated: boolean;
  formula: string;
  sortOrder: number;
  fieldType?: string;
  defaultValue?: string | number | boolean | null;
  width?: number | null;
  options?: string[];
  validation?: Record<string, unknown>;
  description?: string;
  category?: string;
};

export const DEFAULT_LINE_ITEM_COLUMNS: LineItemColumnConfig[] = [
  {
    key: 'productName',
    label: 'Product Name',
    visible: true,
    mandatory: true,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 0,
    fieldType: 'text',
    width: 220,
    defaultValue: ''
  },
  {
    key: 'sku',
    label: 'SKU',
    visible: true,
    mandatory: true,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 1,
    fieldType: 'text',
    width: 140,
    defaultValue: ''
  },
  {
    key: 'quantity',
    label: 'QTY',
    visible: true,
    mandatory: true,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 2,
    fieldType: 'number',
    width: 100,
    defaultValue: 1
  },
  {
    key: 'listPrice',
    label: 'List Price',
    visible: true,
    mandatory: true,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 3,
    fieldType: 'currency',
    width: 130,
    defaultValue: 0
  },
  {
    key: 'cost',
    label: 'Cost',
    visible: true,
    mandatory: true,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 4,
    fieldType: 'currency',
    width: 120,
    defaultValue: 0
  },
  {
    key: 'volumeDiscount',
    label: 'Discount %',
    visible: true,
    mandatory: false,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 5,
    fieldType: 'percent',
    width: 120,
    defaultValue: 0
  },
  {
    key: 'rebate',
    label: 'Rebate',
    visible: true,
    mandatory: false,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 6,
    fieldType: 'currency',
    width: 120,
    defaultValue: 0
  },
  {
    key: 'netPrice',
    label: 'Net Price',
    visible: true,
    mandatory: false,
    editable: false,
    isCalculated: true,
    formula: '',
    sortOrder: 7,
    fieldType: 'currency',
    width: 130
  },
  {
    key: 'margin',
    label: 'Margin %',
    visible: true,
    mandatory: false,
    editable: false,
    isCalculated: true,
    formula: '',
    sortOrder: 8,
    fieldType: 'percent',
    width: 120
  },
    {
      key: 'totalValue',
    label: 'Total Value',
    visible: true,
    mandatory: false,
    editable: false,
    isCalculated: true,
    formula: '',
      sortOrder: 9,
      fieldType: 'currency',
      width: 140
    }
  ];

export const DEFAULT_LINE_ITEM_KEYS = DEFAULT_LINE_ITEM_COLUMNS.map((col) => col.key);
