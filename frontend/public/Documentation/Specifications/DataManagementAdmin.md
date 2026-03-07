# Data Management Admin - Technical Specification

## Overview

Create a **Data Management Admin** system that allows administrators to manage 9 master data tables through CSV import, browse/edit data in a table manager interface, and maintain referential integrity across the pricing application.

## Purpose

Enable business users to import, view, edit, and manage master data without database access or SQL knowledge, supporting enterprise pricing operations with product catalogs, customer data, and configuration tables.

---

## Technical Requirements

### Component Location
- **Main Component**: `/src/app/components/AdminScreen.tsx`
- **Sub-components**:
  - CSV Import Manager (embedded in AdminScreen)
  - `/src/app/components/TableManager.tsx`
  - Data validation utilities
- **Backend**: `/supabase/functions/server/index.tsx` (data management endpoints)

### Dependencies
```typescript
import React, { useState, useEffect } from 'react';
import { 
  Upload, Database, FileText, Download, CheckCircle, 
  AlertCircle, Trash2, Edit, Save, X, Search, Filter,
  RefreshCw, Eye, Plus, Table as TableIcon
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { projectId, publicAnonKey } from '/utils/supabase/info';
```

---

## Master Data Tables

### Complete Table Definitions

```typescript
interface MasterDataTable {
  id: string;
  name: string;
  displayName: string;
  endpoint: string;
  description: string;
  fields: FieldDefinition[];
  sampleCsv: string;
  primaryKey: string;
  requiresValidation: boolean;
  parentTables?: string[];  // For referential integrity
}

interface FieldDefinition {
  name: string;
  displayName: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'email' | 'phone' | 'boolean';
  required: boolean;
  unique?: boolean;
  validation?: ValidationRule;
  description?: string;
}

interface ValidationRule {
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  errorMessage?: string;
}

const MASTER_DATA_TABLES: MasterDataTable[] = [
  {
    id: 'product-hierarchies',
    name: 'product_hierarchies',
    displayName: 'Product Hierarchies',
    endpoint: 'product-hierarchies',
    description: 'Product categorization and hierarchy structure',
    primaryKey: 'id',
    requiresValidation: false,
    fields: [
      {
        name: 'id',
        displayName: 'Hierarchy ID',
        type: 'text',
        required: true,
        unique: true,
        description: 'Unique identifier for hierarchy level'
      },
      {
        name: 'name',
        displayName: 'Name',
        type: 'text',
        required: true,
        description: 'Hierarchy level name'
      },
      {
        name: 'description',
        displayName: 'Description',
        type: 'text',
        required: false,
        description: 'Detailed description'
      },
      {
        name: 'parent_id',
        displayName: 'Parent ID',
        type: 'text',
        required: false,
        description: 'Parent hierarchy level'
      },
      {
        name: 'level',
        displayName: 'Level',
        type: 'number',
        required: false,
        description: 'Hierarchy level (1=top, 2=sub, etc.)'
      }
    ],
    sampleCsv: `id,name,description,parent_id,level
software,Software Solutions,Enterprise software products,,1
hardware,Hardware Products,Physical hardware devices,,1
cloud-services,Cloud Services,SaaS and cloud offerings,software,2`
  },
  {
    id: 'customers',
    name: 'customers',
    displayName: 'Customers',
    endpoint: 'customers',
    description: 'Customer master data with segmentation',
    primaryKey: 'id',
    requiresValidation: true,
    fields: [
      {
        name: 'id',
        displayName: 'Customer ID',
        type: 'text',
        required: true,
        unique: true,
        description: 'Unique customer identifier'
      },
      {
        name: 'name',
        displayName: 'Customer Name',
        type: 'text',
        required: true,
        description: 'Legal business name'
      },
      {
        name: 'type',
        displayName: 'Customer Type',
        type: 'text',
        required: true,
        validation: {
          enum: ['Enterprise', 'Mid-Market', 'SMB', 'Startup'],
          errorMessage: 'Must be Enterprise, Mid-Market, SMB, or Startup'
        },
        description: 'Customer segment'
      },
      {
        name: 'region',
        displayName: 'Region',
        type: 'text',
        required: true,
        description: 'Geographic region'
      },
      {
        name: 'country',
        displayName: 'Country',
        type: 'text',
        required: true,
        description: 'Country code or name'
      },
      {
        name: 'email',
        displayName: 'Email',
        type: 'email',
        required: false,
        validation: {
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          errorMessage: 'Invalid email format'
        },
        description: 'Primary contact email'
      },
      {
        name: 'credit_limit',
        displayName: 'Credit Limit',
        type: 'currency',
        required: false,
        description: 'Maximum credit allowed'
      }
    ],
    sampleCsv: `id,name,type,region,country,email,credit_limit
acme-corp,Acme Corporation,Enterprise,North America,US,contact@acme.com,1000000
techstart-inc,TechStart Inc.,Mid-Market,North America,US,info@techstart.com,250000
global-solutions,Global Solutions Ltd,Enterprise,EMEA,UK,sales@global.co.uk,500000`
  },
  {
    id: 'sales-orgs',
    name: 'sales_orgs',
    displayName: 'Sales Organizations',
    endpoint: 'sales-orgs',
    description: 'Sales organization structure and territories',
    primaryKey: 'id',
    requiresValidation: false,
    fields: [
      {
        name: 'id',
        displayName: 'Org ID',
        type: 'text',
        required: true,
        unique: true
      },
      {
        name: 'name',
        displayName: 'Organization Name',
        type: 'text',
        required: true
      },
      {
        name: 'region',
        displayName: 'Region',
        type: 'text',
        required: true
      },
      {
        name: 'manager',
        displayName: 'Manager Name',
        type: 'text',
        required: false
      },
      {
        name: 'manager_email',
        displayName: 'Manager Email',
        type: 'email',
        required: false
      }
    ],
    sampleCsv: `id,name,region,manager,manager_email
us-east,US East Sales,North America,John Smith,john.smith@company.com
us-west,US West Sales,North America,Jane Doe,jane.doe@company.com
emea,EMEA Sales,Europe,Peter Jones,peter.jones@company.com`
  },
  {
    id: 'regions',
    name: 'regions',
    displayName: 'Regions',
    endpoint: 'regions',
    description: 'Geographic regions and territories',
    primaryKey: 'id',
    requiresValidation: false,
    fields: [
      {
        name: 'id',
        displayName: 'Region ID',
        type: 'text',
        required: true,
        unique: true
      },
      {
        name: 'name',
        displayName: 'Region Name',
        type: 'text',
        required: true
      },
      {
        name: 'countries',
        displayName: 'Countries',
        type: 'text',
        required: false,
        description: 'Comma-separated country codes'
      },
      {
        name: 'currency',
        displayName: 'Currency',
        type: 'text',
        required: false,
        description: 'Default currency (USD, EUR, GBP, etc.)'
      },
      {
        name: 'timezone',
        displayName: 'Timezone',
        type: 'text',
        required: false
      }
    ],
    sampleCsv: `id,name,countries,currency,timezone
north-america,North America,"US,CA,MX",USD,America/New_York
emea,EMEA,"UK,DE,FR,IT,ES",EUR,Europe/London
apac,Asia Pacific,"JP,CN,AU,SG",USD,Asia/Singapore`
  },
  {
    id: 'currencies',
    name: 'currencies',
    displayName: 'Currencies',
    endpoint: 'currencies',
    description: 'Currency codes and exchange rates',
    primaryKey: 'code',
    requiresValidation: false,
    fields: [
      {
        name: 'code',
        displayName: 'Currency Code',
        type: 'text',
        required: true,
        unique: true,
        description: 'ISO 4217 code (USD, EUR, etc.)'
      },
      {
        name: 'name',
        displayName: 'Currency Name',
        type: 'text',
        required: true
      },
      {
        name: 'symbol',
        displayName: 'Symbol',
        type: 'text',
        required: true,
        description: '$, €, £, etc.'
      },
      {
        name: 'exchange_rate',
        displayName: 'Exchange Rate',
        type: 'number',
        required: true,
        description: 'Rate to USD (1 USD = X currency)'
      },
      {
        name: 'decimal_places',
        displayName: 'Decimal Places',
        type: 'number',
        required: false,
        description: 'Number of decimal places (usually 2)'
      }
    ],
    sampleCsv: `code,name,symbol,exchange_rate,decimal_places
USD,US Dollar,$,1.00,2
EUR,Euro,€,0.85,2
GBP,British Pound,£,0.73,2
JPY,Japanese Yen,¥,110.00,0`
  },
  {
    id: 'products',
    name: 'products',
    displayName: 'Products',
    endpoint: 'products',
    description: 'Complete product catalog',
    primaryKey: 'product_sku',
    requiresValidation: true,
    parentTables: ['product_hierarchies'],
    fields: [
      {
        name: 'product_sku',
        displayName: 'Product SKU',
        type: 'text',
        required: true,
        unique: true,
        description: 'Unique product identifier'
      },
      {
        name: 'product_name',
        displayName: 'Product Name',
        type: 'text',
        required: true
      },
      {
        name: 'description',
        displayName: 'Description',
        type: 'text',
        required: false
      },
      {
        name: 'category',
        displayName: 'Category',
        type: 'text',
        required: true,
        description: 'Product category (links to product_hierarchies)'
      },
      {
        name: 'list_price',
        displayName: 'List Price',
        type: 'currency',
        required: true,
        validation: {
          min: 0,
          errorMessage: 'Price must be non-negative'
        }
      },
      {
        name: 'cost',
        displayName: 'Cost',
        type: 'currency',
        required: false,
        validation: {
          min: 0,
          errorMessage: 'Cost must be non-negative'
        }
      },
      {
        name: 'unit_of_measure',
        displayName: 'Unit',
        type: 'text',
        required: false,
        description: 'EA, LB, KG, etc.'
      },
      {
        name: 'active',
        displayName: 'Active',
        type: 'boolean',
        required: false,
        description: 'Is product available for sale'
      }
    ],
    sampleCsv: `product_sku,product_name,description,category,list_price,cost,unit_of_measure,active
SW-001,Enterprise Software Suite,Complete business software package,software,50000,25000,EA,true
HW-001,Server Rack Unit,42U server rack with cooling,hardware,15000,8000,EA,true
CS-001,Cloud Storage Pro,1TB cloud storage service,cloud-services,999,400,EA,true`
  },
  {
    id: 'product-costs',
    name: 'product_costs',
    displayName: 'Product Costs',
    endpoint: 'product-costs',
    description: 'Product cost data by region and time period',
    primaryKey: 'id',
    requiresValidation: true,
    parentTables: ['products', 'regions'],
    fields: [
      {
        name: 'id',
        displayName: 'Cost ID',
        type: 'text',
        required: true,
        unique: true
      },
      {
        name: 'product_sku',
        displayName: 'Product SKU',
        type: 'text',
        required: true,
        description: 'Links to products table'
      },
      {
        name: 'region_id',
        displayName: 'Region',
        type: 'text',
        required: true,
        description: 'Links to regions table'
      },
      {
        name: 'cost',
        displayName: 'Cost',
        type: 'currency',
        required: true,
        validation: {
          min: 0
        }
      },
      {
        name: 'effective_date',
        displayName: 'Effective Date',
        type: 'date',
        required: true,
        description: 'When this cost takes effect'
      },
      {
        name: 'end_date',
        displayName: 'End Date',
        type: 'date',
        required: false,
        description: 'When this cost expires'
      }
    ],
    sampleCsv: `id,product_sku,region_id,cost,effective_date,end_date
cost-001,SW-001,north-america,25000,2024-01-01,
cost-002,SW-001,emea,28000,2024-01-01,
cost-003,HW-001,north-america,8000,2024-01-01,`
  },
  {
    id: 'discount-tiers',
    name: 'discount_tiers',
    displayName: 'Discount Tiers',
    endpoint: 'discount-tiers',
    description: 'Volume discount tier definitions',
    primaryKey: 'id',
    requiresValidation: false,
    fields: [
      {
        name: 'id',
        displayName: 'Tier ID',
        type: 'text',
        required: true,
        unique: true
      },
      {
        name: 'tier_name',
        displayName: 'Tier Name',
        type: 'text',
        required: true
      },
      {
        name: 'min_quantity',
        displayName: 'Min Quantity',
        type: 'number',
        required: true,
        validation: {
          min: 0
        }
      },
      {
        name: 'max_quantity',
        displayName: 'Max Quantity',
        type: 'number',
        required: false,
        description: 'Leave empty for no upper limit'
      },
      {
        name: 'discount_percent',
        displayName: 'Discount %',
        type: 'number',
        required: true,
        validation: {
          min: 0,
          max: 100
        }
      },
      {
        name: 'product_category',
        displayName: 'Product Category',
        type: 'text',
        required: false,
        description: 'Apply to specific category only'
      }
    ],
    sampleCsv: `id,tier_name,min_quantity,max_quantity,discount_percent,product_category
tier-1,Bronze,1,9,0,
tier-2,Silver,10,49,5,
tier-3,Gold,50,99,10,
tier-4,Platinum,100,,15,`
  },
  {
    id: 'pricing-rules',
    name: 'pricing_rules',
    displayName: 'Pricing Rules',
    endpoint: 'pricing-rules',
    description: 'Custom pricing rules and exceptions',
    primaryKey: 'id',
    requiresValidation: true,
    fields: [
      {
        name: 'id',
        displayName: 'Rule ID',
        type: 'text',
        required: true,
        unique: true
      },
      {
        name: 'rule_name',
        displayName: 'Rule Name',
        type: 'text',
        required: true
      },
      {
        name: 'description',
        displayName: 'Description',
        type: 'text',
        required: false
      },
      {
        name: 'customer_type',
        displayName: 'Customer Type',
        type: 'text',
        required: false,
        description: 'Enterprise, Mid-Market, SMB, or blank for all'
      },
      {
        name: 'product_category',
        displayName: 'Product Category',
        type: 'text',
        required: false
      },
      {
        name: 'discount_percent',
        displayName: 'Discount %',
        type: 'number',
        required: false
      },
      {
        name: 'price_multiplier',
        displayName: 'Price Multiplier',
        type: 'number',
        required: false,
        description: '1.0 = no change, 0.9 = 10% off, 1.1 = 10% markup'
      },
      {
        name: 'priority',
        displayName: 'Priority',
        type: 'number',
        required: false,
        description: 'Lower number = higher priority'
      },
      {
        name: 'active',
        displayName: 'Active',
        type: 'boolean',
        required: false
      }
    ],
    sampleCsv: `id,rule_name,description,customer_type,product_category,discount_percent,price_multiplier,priority,active
rule-001,Enterprise Discount,Standard enterprise discount,Enterprise,,15,,1,true
rule-002,Software Bundle,Discount for software bundles,,software,10,,2,true
rule-003,New Customer Promo,First-time customer promotion,,,20,,3,true`
  }
];
```

---

## Component Structure

### AdminScreen Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Admin Dashboard                                              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  [CSV Import] [Table Manager] [Line Item Config] [AI Engine] │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ CSV Import Manager                                     │  │
│  │                                                         │  │
│  │  Select Table: [Dropdown: Products ▼]                 │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 📄 Drag & Drop CSV File Here                    │  │  │
│  │  │                                                   │  │  │
│  │  │        or click to browse                        │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  Expected Format:                                      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ product_sku,product_name,category,list_price    │  │  │
│  │  │ SW-001,Enterprise Suite,software,50000          │  │  │
│  │  │ HW-001,Server Rack,hardware,15000               │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  [📥 Download Sample CSV]                              │  │
│  │                                                         │  │
│  │  Import Results:                                       │  │
│  │  ✅ Successfully imported 47 records                   │  │
│  │  ⚠️  2 warnings (duplicate SKUs updated)               │  │
│  │  ❌ 1 error (invalid price format on row 15)          │  │
│  │                                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Quick Actions                                          │  │
│  │                                                         │  │
│  │  📊 Products (145 records)      [Import] [View]       │  │
│  │  👥 Customers (89 records)      [Import] [View]       │  │
│  │  🏢 Sales Orgs (12 records)     [Import] [View]       │  │
│  │  🌍 Regions (8 records)         [Import] [View]       │  │
│  │  💰 Discount Tiers (15 records) [Import] [View]       │  │
│  │                                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## CSV Import Features

### 1. File Upload Interface

```typescript
interface CSVImportState {
  selectedTable: string;
  file: File | null;
  uploading: boolean;
  results: ImportResult | null;
  errors: ImportError[];
  warnings: ImportWarning[];
}

interface ImportResult {
  success: boolean;
  recordsProcessed: number;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  processingTime: number;
}

interface ImportError {
  row: number;
  field?: string;
  value?: any;
  message: string;
  severity: 'error' | 'warning';
}

interface ImportWarning {
  row: number;
  field?: string;
  message: string;
}
```

### 2. CSV Parsing & Validation

```typescript
const parseCSV = (fileContent: string): ParsedCSV => {
  const lines = fileContent.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  
  const rows = lines.slice(1).map((line, index) => {
    const values = parseCSVLine(line);
    const row: any = { _rowNumber: index + 2 };  // +2 for 1-based and header
    
    headers.forEach((header, i) => {
      row[header] = values[i]?.trim() || '';
    });
    
    return row;
  });
  
  return { headers, rows };
};

const validateRow = (
  row: any, 
  table: MasterDataTable
): ValidationResult => {
  const errors: ImportError[] = [];
  
  // Check required fields
  for (const field of table.fields) {
    if (field.required && !row[field.name]) {
      errors.push({
        row: row._rowNumber,
        field: field.name,
        message: `${field.displayName} is required`,
        severity: 'error'
      });
    }
    
    // Type validation
    if (row[field.name]) {
      const typeError = validateFieldType(row[field.name], field);
      if (typeError) {
        errors.push({
          row: row._rowNumber,
          field: field.name,
          value: row[field.name],
          message: typeError,
          severity: 'error'
        });
      }
    }
    
    // Custom validation rules
    if (field.validation && row[field.name]) {
      const validationError = validateFieldValue(row[field.name], field.validation);
      if (validationError) {
        errors.push({
          row: row._rowNumber,
          field: field.name,
          value: row[field.name],
          message: validationError,
          severity: 'error'
        });
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
};
```

### 3. Import Process Flow

```
1. User selects table
         ↓
2. User uploads CSV file
         ↓
3. Frontend parses CSV
         ↓
4. Validate headers match expected
         ↓
5. Validate each row:
   - Required fields present
   - Data types correct
   - Values within valid ranges
   - Unique constraints satisfied
         ↓
6. Show validation results
         ↓
7. User confirms import
         ↓
8. Send to backend API
         ↓
9. Backend stores data in KV store
         ↓
10. Return success/error counts
         ↓
11. Display results to user
```

### 4. Duplicate Handling

```typescript
const handleDuplicates = (
  newRecords: any[],
  existingRecords: any[],
  primaryKey: string
): DuplicateResolution => {
  const duplicates: any[] = [];
  const newUnique: any[] = [];
  
  for (const record of newRecords) {
    const existing = existingRecords.find(
      e => e[primaryKey] === record[primaryKey]
    );
    
    if (existing) {
      duplicates.push({
        existing,
        new: record,
        action: 'update'  // or 'skip' based on user preference
      });
    } else {
      newUnique.push(record);
    }
  }
  
  return { duplicates, newUnique };
};
```

---

## Table Manager Component

### Component Structure

```typescript
interface TableManagerProps {
  tableName?: string;
  onBack: () => void;
}

interface TableManagerState {
  tables: MasterDataTable[];
  selectedTable: MasterDataTable | null;
  data: any[];
  loading: boolean;
  editingRow: any | null;
  searchQuery: string;
  filterColumn: string | null;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;
}
```

### UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Table Manager                                    [← Back]    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Table: [Products ▼]                                         │
│                                                               │
│  [🔍 Search...]  [Filter ▼]  [+ Add New]  [🗑️ Delete (3)]   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ✓ │ SKU ↑ │ Name      │ Category  │ Price    │ Active │  │
│  ├───┼───────┼───────────┼───────────┼──────────┼────────┤  │
│  │ ☐ │ SW-001│ Ent Suite │ Software  │ $50,000  │   ✓   │  │
│  │ ☐ │ SW-002│ Pro Suite │ Software  │ $25,000  │   ✓   │  │
│  │ ☑ │ HW-001│ Server    │ Hardware  │ $15,000  │   ✓   │  │
│  │ ☑ │ HW-002│ Rack      │ Hardware  │ $8,000   │   ✓   │  │
│  │ ☑ │ CS-001│ Cloud Pro │ Services  │ $999     │   ✓   │  │
│  │ ☐ │ CS-002│ Cloud Ent │ Services  │ $1,999   │   ✓   │  │
│  │   │       │           │           │          │       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  Showing 1-20 of 145 records      [< Prev] [1] [2] [Next >] │
│                                                               │
│  [Export CSV]  [Import CSV]  [Refresh]                       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Table Manager Features

#### 1. Data Grid

```typescript
const renderDataGrid = () => {
  const sortedData = sortData(filteredData, sortColumn, sortDirection);
  const paginatedData = paginate(sortedData, currentPage, pageSize);
  
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="w-10">
            <Checkbox 
              checked={allSelected}
              onChange={toggleSelectAll}
            />
          </th>
          {table.fields.map(field => (
            <th 
              key={field.name}
              onClick={() => handleSort(field.name)}
              className="cursor-pointer hover:bg-gray-100"
            >
              <div className="flex items-center gap-1">
                {field.displayName}
                {sortColumn === field.name && (
                  sortDirection === 'asc' ? <ArrowUp /> : <ArrowDown />
                )}
              </div>
            </th>
          ))}
          <th className="w-32">Actions</th>
        </tr>
      </thead>
      <tbody>
        {paginatedData.map(row => (
          <tr key={row[table.primaryKey]}>
            <td>
              <Checkbox 
                checked={selectedRows.includes(row[table.primaryKey])}
                onChange={() => toggleRow(row[table.primaryKey])}
              />
            </td>
            {table.fields.map(field => (
              <td key={field.name}>
                {editingRow?.id === row.id ? (
                  <Input 
                    value={row[field.name]}
                    onChange={(e) => updateField(field.name, e.target.value)}
                  />
                ) : (
                  formatCellValue(row[field.name], field.type)
                )}
              </td>
            ))}
            <td>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => editRow(row)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => deleteRow(row)}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

#### 2. Search & Filter

```typescript
const searchData = (data: any[], query: string): any[] => {
  if (!query) return data;
  
  const lowerQuery = query.toLowerCase();
  
  return data.filter(row => {
    return Object.values(row).some(value => 
      String(value).toLowerCase().includes(lowerQuery)
    );
  });
};

const filterData = (data: any[], column: string, value: any): any[] => {
  if (!column || !value) return data;
  
  return data.filter(row => row[column] === value);
};
```

#### 3. Inline Editing

```typescript
const startEdit = (row: any) => {
  setEditingRow({ ...row, _original: row });
};

const saveEdit = async () => {
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-acb28b15/table/${selectedTable.name}/${editingRow[table.primaryKey]}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(editingRow),
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      // Update local state
      setData(prev => prev.map(row => 
        row[table.primaryKey] === editingRow[table.primaryKey] 
          ? editingRow 
          : row
      ));
      setEditingRow(null);
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('Error saving row:', error);
    alert('Failed to save changes');
  }
};

const cancelEdit = () => {
  if (editingRow._original) {
    // Restore original values
    setData(prev => prev.map(row => 
      row[table.primaryKey] === editingRow[table.primaryKey]
        ? editingRow._original
        : row
    ));
  }
  setEditingRow(null);
};
```

#### 4. Bulk Operations

```typescript
const deleteBulk = async () => {
  if (selectedRows.length === 0) return;
  
  if (!confirm(`Delete ${selectedRows.length} selected records?`)) return;
  
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-acb28b15/table/${selectedTable.name}/bulk-delete`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ ids: selectedRows }),
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      // Remove from local state
      setData(prev => prev.filter(row => 
        !selectedRows.includes(row[table.primaryKey])
      ));
      setSelectedRows([]);
    }
  } catch (error) {
    console.error('Error deleting rows:', error);
    alert('Failed to delete records');
  }
};
```

#### 5. Export Functionality

```typescript
const exportToCSV = () => {
  const headers = table.fields.map(f => f.name).join(',');
  const rows = data.map(row => 
    table.fields.map(f => {
      const value = row[f.name];
      // Escape values containing commas or quotes
      if (String(value).includes(',') || String(value).includes('"')) {
        return `"${String(value).replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  ).join('\n');
  
  const csv = `${headers}\n${rows}`;
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${selectedTable.name}_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
```

---

## Backend API Endpoints

### 1. CSV Import Endpoint

```typescript
app.post("/make-server-acb28b15/import/:tableName", async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const { data, updateDuplicates = true } = await c.req.json();
    
    console.log(`Importing ${data.length} records to ${tableName}...`);
    
    const startTime = Date.now();
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: ImportError[] = [];
    
    // Get table definition
    const tableConfig = MASTER_DATA_TABLES.find(t => t.name === tableName);
    if (!tableConfig) {
      return c.json({
        success: false,
        error: `Table ${tableName} not found`
      }, 404);
    }
    
    // Get existing data
    const existingData = await kv.getByPrefix(`table:${tableName}:`);
    const existingMap = new Map(
      existingData.map(item => [item[tableConfig.primaryKey], item])
    );
    
    // Process each record
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const primaryKeyValue = record[tableConfig.primaryKey];
      
      // Validate record
      const validation = validateRecord(record, tableConfig);
      if (!validation.valid) {
        errors.push(...validation.errors);
        skipped++;
        continue;
      }
      
      // Check for duplicate
      const exists = existingMap.has(primaryKeyValue);
      
      if (exists && !updateDuplicates) {
        skipped++;
        continue;
      }
      
      // Store record
      const key = `table:${tableName}:${primaryKeyValue}`;
      await kv.set(key, {
        ...record,
        _imported_at: new Date().toISOString(),
        _updated_at: new Date().toISOString()
      });
      
      if (exists) {
        updated++;
      } else {
        imported++;
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    console.log(`Import complete: ${imported} new, ${updated} updated, ${skipped} skipped, ${errors.length} errors (${processingTime}ms)`);
    
    return c.json({
      success: true,
      data: {
        recordsProcessed: data.length,
        recordsImported: imported,
        recordsUpdated: updated,
        recordsSkipped: skipped,
        errors: errors,
        processingTime
      }
    });
    
  } catch (error) {
    console.error("Error importing data:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
```

### 2. Get Table Data

```typescript
app.get("/make-server-acb28b15/table/:tableName", async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const { page = 1, pageSize = 50, search, sortBy, sortDir = 'asc' } = c.req.query();
    
    // Get all data for this table
    const data = await kv.getByPrefix(`table:${tableName}:`);
    
    // Apply search filter
    let filtered = data;
    if (search) {
      filtered = data.filter(record => 
        Object.values(record).some(value =>
          String(value).toLowerCase().includes(search.toLowerCase())
        )
      );
    }
    
    // Apply sorting
    if (sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        if (sortDir === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
    }
    
    // Pagination
    const startIndex = (Number(page) - 1) * Number(pageSize);
    const endIndex = startIndex + Number(pageSize);
    const paginated = filtered.slice(startIndex, endIndex);
    
    return c.json({
      success: true,
      data: paginated,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / Number(pageSize))
      }
    });
    
  } catch (error) {
    console.error("Error getting table data:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
```

### 3. Update Single Record

```typescript
app.put("/make-server-acb28b15/table/:tableName/:id", async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const id = c.req.param('id');
    const updates = await c.req.json();
    
    // Get existing record
    const key = `table:${tableName}:${id}`;
    const existing = await kv.get(key);
    
    if (!existing) {
      return c.json({
        success: false,
        error: 'Record not found'
      }, 404);
    }
    
    // Merge updates
    const updated = {
      ...existing,
      ...updates,
      _updated_at: new Date().toISOString()
    };
    
    // Validate
    const tableConfig = MASTER_DATA_TABLES.find(t => t.name === tableName);
    if (tableConfig) {
      const validation = validateRecord(updated, tableConfig);
      if (!validation.valid) {
        return c.json({
          success: false,
          error: 'Validation failed',
          errors: validation.errors
        }, 400);
      }
    }
    
    // Save
    await kv.set(key, updated);
    
    return c.json({
      success: true,
      data: updated
    });
    
  } catch (error) {
    console.error("Error updating record:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
```

### 4. Delete Single Record

```typescript
app.delete("/make-server-acb28b15/table/:tableName/:id", async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const id = c.req.param('id');
    
    const key = `table:${tableName}:${id}`;
    
    // Check if exists
    const existing = await kv.get(key);
    if (!existing) {
      return c.json({
        success: false,
        error: 'Record not found'
      }, 404);
    }
    
    // Delete
    await kv.delete(key);
    
    console.log(`Deleted ${tableName} record: ${id}`);
    
    return c.json({
      success: true,
      message: 'Record deleted successfully'
    });
    
  } catch (error) {
    console.error("Error deleting record:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
```

### 5. Bulk Delete

```typescript
app.delete("/make-server-acb28b15/table/:tableName/bulk-delete", async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const { ids } = await c.req.json();
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({
        success: false,
        error: 'No IDs provided'
      }, 400);
    }
    
    let deleted = 0;
    const errors: string[] = [];
    
    for (const id of ids) {
      try {
        const key = `table:${tableName}:${id}`;
        await kv.delete(key);
        deleted++;
      } catch (error) {
        errors.push(`Failed to delete ${id}: ${error.message}`);
      }
    }
    
    console.log(`Bulk delete: ${deleted} deleted, ${errors.length} errors`);
    
    return c.json({
      success: true,
      data: {
        deleted,
        errors: errors.length > 0 ? errors : undefined
      }
    });
    
  } catch (error) {
    console.error("Error in bulk delete:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
```

### 6. Get Table Schema

```typescript
app.get("/make-server-acb28b15/table-schemas", async (c) => {
  try {
    const schemas = {};
    
    for (const table of MASTER_DATA_TABLES) {
      schemas[table.name] = {
        displayName: table.displayName,
        primaryKey: table.primaryKey,
        fields: table.fields,
        sampleCsv: table.sampleCsv,
        description: table.description
      };
    }
    
    return c.json({
      success: true,
      data: schemas
    });
    
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
```

### 7. Get Table Stats

```typescript
app.get("/make-server-acb28b15/table/:tableName/stats", async (c) => {
  try {
    const tableName = c.req.param('tableName');
    
    const data = await kv.getByPrefix(`table:${tableName}:`);
    
    const stats = {
      totalRecords: data.length,
      lastUpdated: data.length > 0 
        ? Math.max(...data.map(r => new Date(r._updated_at || r._imported_at).getTime()))
        : null,
      fieldStats: {}
    };
    
    // Calculate field statistics
    const tableConfig = MASTER_DATA_TABLES.find(t => t.name === tableName);
    if (tableConfig && data.length > 0) {
      for (const field of tableConfig.fields) {
        const values = data.map(r => r[field.name]).filter(v => v != null);
        
        stats.fieldStats[field.name] = {
          populated: values.length,
          populatedPercent: (values.length / data.length * 100).toFixed(1),
          unique: new Set(values).size
        };
        
        if (field.type === 'number' || field.type === 'currency') {
          const numbers = values.map(v => Number(v)).filter(n => !isNaN(n));
          if (numbers.length > 0) {
            stats.fieldStats[field.name].min = Math.min(...numbers);
            stats.fieldStats[field.name].max = Math.max(...numbers);
            stats.fieldStats[field.name].avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
          }
        }
      }
    }
    
    return c.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
```

---

## Validation Utilities

### Field Type Validation

```typescript
const validateFieldType = (value: any, field: FieldDefinition): string | null => {
  if (!value) return null;
  
  switch (field.type) {
    case 'number':
    case 'currency':
      if (isNaN(Number(value))) {
        return `${field.displayName} must be a valid number`;
      }
      break;
      
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return `${field.displayName} must be a valid email address`;
      }
      break;
      
    case 'date':
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return `${field.displayName} must be a valid date`;
      }
      break;
      
    case 'boolean':
      const validBooleans = ['true', 'false', '1', '0', 'yes', 'no'];
      if (!validBooleans.includes(String(value).toLowerCase())) {
        return `${field.displayName} must be true/false or yes/no`;
      }
      break;
  }
  
  return null;
};

const validateFieldValue = (value: any, validation: ValidationRule): string | null => {
  if (validation.min !== undefined && Number(value) < validation.min) {
    return validation.errorMessage || `Value must be at least ${validation.min}`;
  }
  
  if (validation.max !== undefined && Number(value) > validation.max) {
    return validation.errorMessage || `Value must be at most ${validation.max}`;
  }
  
  if (validation.pattern && !validation.pattern.test(String(value))) {
    return validation.errorMessage || `Value does not match required pattern`;
  }
  
  if (validation.enum && !validation.enum.includes(String(value))) {
    return validation.errorMessage || `Value must be one of: ${validation.enum.join(', ')}`;
  }
  
  return null;
};
```

### Referential Integrity Check

```typescript
const validateReferentialIntegrity = async (
  record: any,
  table: MasterDataTable
): Promise<ValidationError[]> => {
  const errors: ValidationError[] = [];
  
  if (!table.parentTables) return errors;
  
  for (const parentTable of table.parentTables) {
    // Find fields that reference this parent table
    const refFields = table.fields.filter(f => 
      f.description?.includes(`links to ${parentTable}`) ||
      f.name.includes(parentTable.replace('_', ''))
    );
    
    for (const field of refFields) {
      const value = record[field.name];
      if (value) {
        // Check if referenced record exists
        const key = `table:${parentTable}:${value}`;
        const exists = await kv.get(key);
        
        if (!exists) {
          errors.push({
            row: record._rowNumber,
            field: field.name,
            value,
            message: `Referenced ${parentTable} record "${value}" does not exist`,
            severity: 'error'
          });
        }
      }
    }
  }
  
  return errors;
};
```

---

## CSV Format Examples

### Products CSV
```csv
product_sku,product_name,description,category,list_price,cost,unit_of_measure,active
SW-001,Enterprise Software Suite,Complete business software package,software,50000,25000,EA,true
SW-002,Professional Suite,Professional edition software,software,25000,12000,EA,true
HW-001,Server Rack Unit,42U server rack with cooling,hardware,15000,8000,EA,true
HW-002,Network Switch,48-port managed switch,hardware,5000,2500,EA,true
CS-001,Cloud Storage Pro,1TB cloud storage service,cloud-services,999,400,EA,true
```

### Customers CSV
```csv
id,name,type,region,country,email,credit_limit
acme-corp,Acme Corporation,Enterprise,North America,US,contact@acme.com,1000000
techstart-inc,TechStart Inc.,Mid-Market,North America,US,info@techstart.com,250000
global-solutions,Global Solutions Ltd,Enterprise,EMEA,UK,sales@global.co.uk,500000
startup-co,Startup Co,Startup,North America,US,hello@startup.co,50000
```

### Discount Tiers CSV
```csv
id,tier_name,min_quantity,max_quantity,discount_percent,product_category
tier-1,Bronze,1,9,0,
tier-2,Silver,10,49,5,
tier-3,Gold,50,99,10,
tier-4,Platinum,100,199,15,
tier-5,Diamond,200,,20,
```

---

## Error Handling

### User-Friendly Error Messages

```typescript
const ERROR_MESSAGES = {
  INVALID_CSV: 'The CSV file format is invalid. Please check that it matches the expected format.',
  MISSING_REQUIRED: 'Required field "{field}" is missing in row {row}.',
  INVALID_TYPE: 'Field "{field}" in row {row} has invalid type. Expected {expected}, got {actual}.',
  DUPLICATE_KEY: 'Record with {key}="{value}" already exists. Use update mode to overwrite.',
  REFERENCE_NOT_FOUND: 'Referenced record "{value}" in field "{field}" does not exist in {table}.',
  VALIDATION_FAILED: 'Value "{value}" for field "{field}" failed validation: {reason}',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  SERVER_ERROR: 'Server error occurred. Please try again or contact support.'
};

const formatError = (error: ImportError): string => {
  let message = ERROR_MESSAGES[error.type] || error.message;
  
  // Replace placeholders
  message = message.replace('{field}', error.field || '');
  message = message.replace('{row}', String(error.row || ''));
  message = message.replace('{value}', String(error.value || ''));
  
  return message;
};
```

### Error Display Component

```typescript
const ErrorDisplay = ({ errors }: { errors: ImportError[] }) => {
  if (errors.length === 0) return null;
  
  const errorsByRow = groupBy(errors, 'row');
  
  return (
    <Alert variant="destructive" className="mt-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="font-semibold mb-2">
          Found {errors.length} error{errors.length !== 1 ? 's' : ''} in {Object.keys(errorsByRow).length} row{Object.keys(errorsByRow).length !== 1 ? 's' : ''}
        </div>
        <div className="max-h-60 overflow-auto space-y-2">
          {Object.entries(errorsByRow).map(([row, rowErrors]) => (
            <div key={row} className="text-sm">
              <strong>Row {row}:</strong>
              <ul className="list-disc list-inside ml-4">
                {(rowErrors as ImportError[]).map((error, idx) => (
                  <li key={idx}>{formatError(error)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
};
```

---

## Testing Scenarios

### Test 1: Valid CSV Import
1. Select "Products" table
2. Upload valid products.csv
3. **Verify**: All records imported successfully
4. **Verify**: Success message with count displayed
5. **Verify**: Records visible in Table Manager

### Test 2: CSV with Validation Errors
1. Upload CSV with:
   - Missing required field
   - Invalid email format
   - Negative price
2. **Verify**: Import blocked
3. **Verify**: Specific errors shown for each row
4. **Verify**: No data imported

### Test 3: Duplicate Handling
1. Import CSV with 10 products
2. Import same CSV again
3. **Verify**: Option to update or skip
4. **Verify**: If update: records updated
5. **Verify**: If skip: no changes made

### Test 4: Referential Integrity
1. Import products with category "electronics"
2. Category doesn't exist in product_hierarchies
3. **Verify**: Warning or error shown
4. **Verify**: Suggestion to import category first

### Test 5: Table Manager CRUD
1. Open Table Manager
2. Search for "Software"
3. **Verify**: Filtered results shown
4. Edit a record
5. **Verify**: Changes saved
6. Delete a record
7. **Verify**: Record removed

### Test 6: Bulk Operations
1. Select 5 records
2. Click "Delete Selected"
3. Confirm deletion
4. **Verify**: All 5 records deleted
5. **Verify**: Table refreshed

### Test 7: Export CSV
1. Filter data in Table Manager
2. Click "Export CSV"
3. **Verify**: File downloads
4. **Verify**: Contains filtered data only
5. **Verify**: Format matches import format

### Test 8: Pagination
1. Import 100 records
2. Navigate through pages
3. **Verify**: 50 records per page
4. **Verify**: Page numbers correct
5. **Verify**: Total count accurate

---

## UI Components

### CSV Upload Dropzone

```typescript
const CSVDropzone = ({ onFileSelect }: { onFileSelect: (file: File) => void }) => {
  const [dragActive, setDragActive] = useState(false);
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      onFileSelect(file);
    } else {
      alert('Please upload a CSV file');
    }
  };
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };
  
  return (
    <div
      className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
        dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
      onDragEnter={() => setDragActive(true)}
      onDragLeave={() => setDragActive(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
      <p className="text-lg font-medium text-gray-700 mb-2">
        Drag & Drop CSV File Here
      </p>
      <p className="text-sm text-gray-500 mb-4">
        or click to browse
      </p>
      <input
        type="file"
        accept=".csv"
        onChange={handleFileInput}
        className="hidden"
        id="csv-upload"
      />
      <label htmlFor="csv-upload">
        <Button variant="outline" as="span">
          Browse Files
        </Button>
      </label>
    </div>
  );
};
```

### Import Progress Indicator

```typescript
const ImportProgress = ({ 
  status, 
  progress 
}: { 
  status: string; 
  progress: number;
}) => {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-2">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
        <span className="font-medium">{status}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
    </Card>
  );
};
```

### Table Stats Display

```typescript
const TableStatsCard = ({ tableName, stats }: { tableName: string; stats: any }) => {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{tableName}</h3>
        <Database className="w-5 h-5 text-blue-600" />
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Total Records:</span>
          <span className="font-medium">{stats.totalRecords}</span>
        </div>
        {stats.lastUpdated && (
          <div className="flex justify-between">
            <span className="text-gray-600">Last Updated:</span>
            <span className="font-medium">
              {new Date(stats.lastUpdated).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          <Eye className="w-4 h-4 mr-1" />
          View
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          <Upload className="w-4 h-4 mr-1" />
          Import
        </Button>
      </div>
    </Card>
  );
};
```

---

## Success Criteria

### ✅ Functional Requirements
- Users can import CSV files for all 9 tables
- Validation errors prevent invalid data import
- Duplicate records handled appropriately
- Table Manager displays all table data
- Users can search, filter, and sort data
- Inline editing works for all field types
- Bulk operations (delete) work correctly
- CSV export generates valid files
- Referential integrity maintained

### ✅ Technical Requirements
- TypeScript with proper types
- React functional components
- Supabase KV store integration
- Error handling and validation
- Loading states during operations
- Responsive design
- Performance optimized for large datasets

### ✅ User Experience
- Clear upload interface
- Real-time validation feedback
- Detailed error messages
- Progress indicators
- Confirmation dialogs
- Sample CSV downloads
- Intuitive table navigation
- Fast data operations

---

## Code Generation Prompt

To regenerate this component, use:

```
Create a Data Management Admin system based on the technical specification in DataManagementAdmin.md.

Requirements:
1. Create AdminScreen.tsx with CSV import functionality for 9 tables
2. Create TableManager.tsx with full CRUD operations
3. Implement CSV parsing and validation
4. Add all backend API endpoints to /supabase/functions/server/index.tsx
5. Include referential integrity validation
6. Support search, filter, sort, and pagination
7. Add inline editing with validation
8. Implement bulk operations (delete, export)
9. Include error handling with user-friendly messages
10. Add sample CSV generation

Follow all data structures, table definitions, validation rules, and UI specifications exactly as documented. Include all 9 master data tables with their complete field definitions.
```

---

## Summary

This specification provides a complete blueprint for creating a comprehensive Data Management Admin system with CSV import, table manager, and full CRUD operations for 9 master data tables. The system includes validation, error handling, referential integrity checks, and a user-friendly interface for business users to manage pricing application data without technical knowledge.

**All technical details, data structures, API endpoints, validation logic, and UI components are fully specified for error-free generation.**
