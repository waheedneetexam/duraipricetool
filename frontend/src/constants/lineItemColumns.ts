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
    sortOrder: 0
  },
  {
    key: 'sku',
    label: 'SKU',
    visible: true,
    mandatory: true,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 1
  },
  {
    key: 'quantity',
    label: 'QTY',
    visible: true,
    mandatory: true,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 2
  },
  {
    key: 'listPrice',
    label: 'List Price',
    visible: true,
    mandatory: true,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 3
  },
  {
    key: 'cost',
    label: 'Cost',
    visible: true,
    mandatory: true,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 4
  },
  {
    key: 'volumeDiscount',
    label: 'Discount %',
    visible: true,
    mandatory: false,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 5
  },
  {
    key: 'rebate',
    label: 'Rebate',
    visible: true,
    mandatory: false,
    editable: true,
    isCalculated: false,
    formula: '',
    sortOrder: 6
  },
  {
    key: 'netPrice',
    label: 'Net Price',
    visible: true,
    mandatory: false,
    editable: false,
    isCalculated: true,
    formula: '',
    sortOrder: 7
  },
  {
    key: 'margin',
    label: 'Margin %',
    visible: true,
    mandatory: false,
    editable: false,
    isCalculated: true,
    formula: '',
    sortOrder: 8
  },
    {
      key: 'totalValue',
    label: 'Total Value',
    visible: true,
    mandatory: false,
    editable: false,
    isCalculated: true,
    formula: '',
      sortOrder: 9
    }
  ];

export const DEFAULT_LINE_ITEM_KEYS = DEFAULT_LINE_ITEM_COLUMNS.map((col) => col.key);
