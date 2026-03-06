# Line Item Configurator - Technical Specification

## Overview

Create a **Line Item Configurator** component that allows administrators to dynamically add, edit, delete, and reorder fields in quote line items. Changes should be reflected immediately in the quote line item interface.

## Purpose

Enable business users to customize the line item structure without code changes, supporting different industries, products, and pricing models.

---

## Technical Requirements

### Component Location
- **Path**: `/src/app/components/LineItemConfigurator.tsx`
- **Type**: React Functional Component with TypeScript
- **Parent**: Embedded in AdminScreen component as a tab

### Dependencies
```typescript
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription } from './ui/alert';
import { projectId, publicAnonKey } from '/utils/supabase/info';
```

---

## Data Structures

### Field Interface
```typescript
interface LineItemField {
  id: string;                    // Unique identifier (e.g., "field_1234567890")
  name: string;                  // Internal name (e.g., "unit_price", "discount_percent")
  displayName: string;           // User-facing label (e.g., "Unit Price", "Discount %")
  type: FieldType;              // Data type
  required: boolean;            // Is field mandatory?
  editable: boolean;            // Can users edit this field?
  calculated: boolean;          // Is this a calculated field?
  formula?: string;             // JavaScript formula if calculated
  defaultValue?: any;           // Default value for new line items
  order: number;                // Display order (0, 1, 2, ...)
  width?: number;               // Column width in pixels
  visible: boolean;             // Show/hide in UI
  options?: string[];           // For dropdown/select types
  validation?: FieldValidation; // Validation rules
  description?: string;         // Help text
  category?: string;            // Grouping category
}

type FieldType = 
  | 'text'           // String input
  | 'number'         // Numeric input
  | 'currency'       // Money (formatted number)
  | 'percent'        // Percentage
  | 'date'           // Date picker
  | 'select'         // Dropdown
  | 'textarea'       // Multi-line text
  | 'checkbox'       // Boolean
  | 'calculated';    // Auto-calculated

interface FieldValidation {
  min?: number;           // Minimum value (for numbers)
  max?: number;           // Maximum value (for numbers)
  minLength?: number;     // Min string length
  maxLength?: number;     // Max string length
  pattern?: string;       // Regex pattern
  errorMessage?: string;  // Custom error message
}
```

### Default Line Item Fields
```typescript
const DEFAULT_LINE_ITEM_FIELDS: LineItemField[] = [
  {
    id: 'product_sku',
    name: 'product_sku',
    displayName: 'Product SKU',
    type: 'text',
    required: true,
    editable: true,
    calculated: false,
    order: 0,
    width: 150,
    visible: true,
    description: 'Product identifier'
  },
  {
    id: 'product_name',
    name: 'product_name',
    displayName: 'Product Name',
    type: 'text',
    required: true,
    editable: true,
    calculated: false,
    order: 1,
    width: 200,
    visible: true,
    description: 'Product description'
  },
  {
    id: 'quantity',
    name: 'quantity',
    displayName: 'Quantity',
    type: 'number',
    required: true,
    editable: true,
    calculated: false,
    defaultValue: 1,
    order: 2,
    width: 100,
    visible: true,
    validation: { min: 1 }
  },
  {
    id: 'unit_price',
    name: 'unit_price',
    displayName: 'Unit Price',
    type: 'currency',
    required: true,
    editable: true,
    calculated: false,
    defaultValue: 0,
    order: 3,
    width: 120,
    visible: true,
    validation: { min: 0 }
  },
  {
    id: 'extended_price',
    name: 'extended_price',
    displayName: 'Extended Price',
    type: 'currency',
    required: false,
    editable: false,
    calculated: true,
    formula: 'quantity * unit_price',
    order: 4,
    width: 120,
    visible: true,
    description: 'Quantity × Unit Price'
  }
];
```

---

## Component Features

### 1. Field List Display
- **Show all configured fields** in a table/card grid
- **Display**: Field name, type, required, editable, calculated, order
- **Visual indicators**: Icons for calculated fields, required fields
- **Sorting**: By order number (ascending)
- **Filtering**: Show/hide categories

### 2. Add New Field
- **Modal/drawer** form to add field
- **Required inputs**:
  - Field name (must be unique, no spaces)
  - Display name
  - Field type (dropdown)
  - Required (checkbox)
  - Editable (checkbox)
  - Calculated (checkbox)
- **Conditional inputs**:
  - Formula (if calculated = true)
  - Options (if type = 'select')
  - Validation rules (if type = 'number' or 'currency')
  - Default value
- **Validation**:
  - Field name must be unique
  - Field name must be valid JavaScript identifier
  - Formula must be valid if calculated
- **Auto-assign order**: Next highest number

### 3. Edit Field
- **Open modal** with pre-filled values
- **Same form** as add field
- **Cannot change**: Field ID
- **Warning**: If field has data, changing type may cause issues
- **Save button**: Updates field configuration

### 4. Delete Field
- **Confirmation dialog**: "Are you sure?"
- **Warning**: "This field may have data in existing quotes"
- **Action**: Remove field from configuration
- **Reorder**: Adjust order numbers of remaining fields

### 5. Reorder Fields
- **Drag handles**: Using GripVertical icon
- **Up/Down buttons**: Move field up or down in order
- **Auto-save**: Update order numbers after move
- **Visual feedback**: Highlight during drag

### 6. Field Type Selector

```typescript
const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: 'Type' },
  { value: 'number', label: 'Number', icon: 'Hash' },
  { value: 'currency', label: 'Currency', icon: 'DollarSign' },
  { value: 'percent', label: 'Percentage', icon: 'Percent' },
  { value: 'date', label: 'Date', icon: 'Calendar' },
  { value: 'select', label: 'Dropdown', icon: 'ChevronDown' },
  { value: 'textarea', label: 'Text Area', icon: 'AlignLeft' },
  { value: 'checkbox', label: 'Checkbox', icon: 'CheckSquare' },
  { value: 'calculated', label: 'Calculated', icon: 'Calculator' }
];
```

### 7. Formula Builder (for calculated fields)

**Simple formula input**:
```typescript
// Example formulas
"quantity * unit_price"
"unit_price * (1 - discount_percent / 100)"
"extended_price - cost"
"(extended_price - total_cost) / extended_price * 100"
```

**Available variables**:
- All other field names in the line item
- Header fields via `header.field_name`
- Math operations: +, -, *, /, %, ()
- Functions: Math.round(), Math.ceil(), Math.floor(), Math.max(), Math.min()

**Validation**:
- Check formula syntax
- Verify referenced fields exist
- Prevent circular dependencies

### 8. Field Preview

**Show preview** of how field will appear:
```typescript
interface FieldPreview {
  fieldName: string;
  displayName: string;
  type: FieldType;
  sampleValue: any;
  width: number;
}
```

**Preview component**:
- Mock table cell showing the field
- Sample data based on type
- Proper formatting (currency, percent, date)

---

## UI/UX Specifications

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│ Line Item Configurator                    [+ Add]   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ [≡] Product SKU          Text      Required  │  │
│  │     Order: 0             Editable  [↑][↓]    │  │
│  │                          [Edit] [Delete]      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ [≡] Product Name         Text      Required  │  │
│  │     Order: 1             Editable  [↑][↓]    │  │
│  │                          [Edit] [Delete]      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ [≡] Extended Price       Currency  🧮        │  │
│  │     Order: 4             Calculated [↑][↓]   │  │
│  │     Formula: quantity * unit_price            │  │
│  │                          [Edit] [Delete]      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  Total Fields: 5                                    │
└─────────────────────────────────────────────────────┘
```

### Field Card Design

```typescript
<Card className="p-4 mb-3 hover:shadow-md transition-shadow">
  <div className="flex items-start justify-between">
    <div className="flex items-start gap-3 flex-1">
      {/* Drag Handle */}
      <GripVertical className="w-5 h-5 text-gray-400 cursor-grab" />
      
      {/* Field Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900">{field.displayName}</h3>
          {field.required && (
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
              Required
            </span>
          )}
          {field.calculated && (
            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded flex items-center gap-1">
              <Calculator className="w-3 h-3" />
              Calculated
            </span>
          )}
        </div>
        
        <div className="text-sm text-gray-600 space-y-1">
          <div>Name: <code className="text-xs bg-gray-100 px-1 rounded">{field.name}</code></div>
          <div>Type: <span className="font-medium">{field.type}</span></div>
          <div>Order: {field.order}</div>
          {field.formula && (
            <div>Formula: <code className="text-xs bg-gray-100 px-1 rounded">{field.formula}</code></div>
          )}
        </div>
      </div>
    </div>
    
    {/* Actions */}
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" onClick={() => moveUp(field.id)}>
        <ArrowUp className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => moveDown(field.id)}>
        <ArrowDown className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editField(field)}>
        <Edit className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => deleteField(field.id)}>
        <Trash2 className="w-4 h-4 text-red-600" />
      </Button>
    </div>
  </div>
</Card>
```

### Add/Edit Field Modal

```typescript
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto bg-white p-6">
    <h2 className="text-xl font-bold mb-4">
      {editingField ? 'Edit Field' : 'Add New Field'}
    </h2>
    
    <div className="space-y-4">
      {/* Field Name */}
      <div>
        <Label>Field Name (Internal)</Label>
        <Input 
          placeholder="e.g., discount_percent"
          pattern="[a-z_][a-z0-9_]*"
        />
        <p className="text-xs text-gray-500 mt-1">
          Lowercase letters, numbers, underscores only. No spaces.
        </p>
      </div>
      
      {/* Display Name */}
      <div>
        <Label>Display Name</Label>
        <Input placeholder="e.g., Discount Percentage" />
      </div>
      
      {/* Field Type */}
      <div>
        <Label>Field Type</Label>
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Checkboxes */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id="required" />
          <Label htmlFor="required">Required</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="editable" />
          <Label htmlFor="editable">Editable</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="calculated" />
          <Label htmlFor="calculated">Calculated</Label>
        </div>
      </div>
      
      {/* Conditional: Formula (if calculated) */}
      {isCalculated && (
        <div>
          <Label>Formula</Label>
          <Input placeholder="e.g., quantity * unit_price" />
          <p className="text-xs text-gray-500 mt-1">
            Use field names and math operators: +, -, *, /, %
          </p>
        </div>
      )}
      
      {/* Conditional: Options (if select) */}
      {type === 'select' && (
        <div>
          <Label>Options (one per line)</Label>
          <textarea className="w-full border rounded p-2" rows={4} />
        </div>
      )}
      
      {/* Default Value */}
      <div>
        <Label>Default Value (Optional)</Label>
        <Input />
      </div>
      
      {/* Description */}
      <div>
        <Label>Description (Optional)</Label>
        <Input placeholder="Help text for users" />
      </div>
    </div>
    
    {/* Actions */}
    <div className="flex justify-end gap-2 mt-6">
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button onClick={saveField}>
        {editingField ? 'Update Field' : 'Add Field'}
      </Button>
    </div>
  </Card>
</div>
```

---

## Backend API Endpoints

### 1. Get Line Item Configuration
```typescript
GET /make-server-acb28b15/config/line-item-fields

Response:
{
  success: true,
  data: LineItemField[]
}
```

### 2. Save Line Item Configuration
```typescript
POST /make-server-acb28b15/config/line-item-fields

Request Body:
{
  fields: LineItemField[]
}

Response:
{
  success: true,
  message: "Configuration saved successfully"
}
```

### 3. Add Single Field
```typescript
POST /make-server-acb28b15/config/line-item-fields/add

Request Body:
{
  field: LineItemField
}

Response:
{
  success: true,
  data: LineItemField
}
```

### 4. Update Single Field
```typescript
PUT /make-server-acb28b15/config/line-item-fields/:fieldId

Request Body:
{
  field: Partial<LineItemField>
}

Response:
{
  success: true,
  data: LineItemField
}
```

### 5. Delete Field
```typescript
DELETE /make-server-acb28b15/config/line-item-fields/:fieldId

Response:
{
  success: true,
  message: "Field deleted successfully"
}
```

### 6. Reorder Fields
```typescript
POST /make-server-acb28b15/config/line-item-fields/reorder

Request Body:
{
  fieldIds: string[]  // Ordered array of field IDs
}

Response:
{
  success: true,
  data: LineItemField[]
}
```

---

## Backend Implementation (Supabase KV)

```typescript
// In /supabase/functions/server/index.tsx

// Get configuration
app.get("/make-server-acb28b15/config/line-item-fields", async (c) => {
  try {
    let fields = await kv.get("config:line_item_fields");
    
    // Initialize with defaults if not exists
    if (!fields || fields.length === 0) {
      fields = DEFAULT_LINE_ITEM_FIELDS;
      await kv.set("config:line_item_fields", fields);
    }
    
    return c.json({ success: true, data: fields });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Save configuration
app.post("/make-server-acb28b15/config/line-item-fields", async (c) => {
  try {
    const { fields } = await c.req.json();
    
    // Validate fields
    if (!Array.isArray(fields)) {
      return c.json({ success: false, error: "Invalid fields data" }, 400);
    }
    
    // Save to KV store
    await kv.set("config:line_item_fields", fields);
    
    console.log(`Saved ${fields.length} line item fields`);
    
    return c.json({ 
      success: true, 
      message: "Configuration saved successfully" 
    });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Add field
app.post("/make-server-acb28b15/config/line-item-fields/add", async (c) => {
  try {
    const { field } = await c.req.json();
    
    // Get existing fields
    const fields = await kv.get("config:line_item_fields") || [];
    
    // Check for duplicate name
    const exists = fields.find((f: LineItemField) => f.name === field.name);
    if (exists) {
      return c.json({ 
        success: false, 
        error: "Field name already exists" 
      }, 400);
    }
    
    // Generate ID if not provided
    if (!field.id) {
      field.id = `field_${Date.now()}`;
    }
    
    // Set order to end if not provided
    if (field.order === undefined) {
      field.order = fields.length;
    }
    
    // Add field
    fields.push(field);
    
    // Save
    await kv.set("config:line_item_fields", fields);
    
    return c.json({ success: true, data: field });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Update field
app.put("/make-server-acb28b15/config/line-item-fields/:fieldId", async (c) => {
  try {
    const { fieldId } = c.req.param();
    const { field: updates } = await c.req.json();
    
    // Get existing fields
    const fields = await kv.get("config:line_item_fields") || [];
    
    // Find field
    const index = fields.findIndex((f: LineItemField) => f.id === fieldId);
    if (index === -1) {
      return c.json({ success: false, error: "Field not found" }, 404);
    }
    
    // Update field
    fields[index] = { ...fields[index], ...updates };
    
    // Save
    await kv.set("config:line_item_fields", fields);
    
    return c.json({ success: true, data: fields[index] });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Delete field
app.delete("/make-server-acb28b15/config/line-item-fields/:fieldId", async (c) => {
  try {
    const { fieldId } = c.req.param();
    
    // Get existing fields
    let fields = await kv.get("config:line_item_fields") || [];
    
    // Remove field
    fields = fields.filter((f: LineItemField) => f.id !== fieldId);
    
    // Reorder remaining fields
    fields = fields.map((f: LineItemField, idx: number) => ({
      ...f,
      order: idx
    }));
    
    // Save
    await kv.set("config:line_item_fields", fields);
    
    return c.json({ success: true, message: "Field deleted successfully" });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Reorder fields
app.post("/make-server-acb28b15/config/line-item-fields/reorder", async (c) => {
  try {
    const { fieldIds } = await c.req.json();
    
    // Get existing fields
    const fields = await kv.get("config:line_item_fields") || [];
    
    // Create map for quick lookup
    const fieldMap = new Map(fields.map((f: LineItemField) => [f.id, f]));
    
    // Reorder based on fieldIds array
    const reordered = fieldIds.map((id: string, idx: number) => {
      const field = fieldMap.get(id);
      if (field) {
        return { ...field, order: idx };
      }
      return null;
    }).filter(Boolean);
    
    // Save
    await kv.set("config:line_item_fields", reordered);
    
    return c.json({ success: true, data: reordered });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});
```

---

## Integration with PricingTable

### Dynamic Column Generation

In `PricingTable.tsx`, load configuration and generate columns:

```typescript
const [lineItemFields, setLineItemFields] = useState<LineItemField[]>([]);

useEffect(() => {
  loadLineItemConfiguration();
}, []);

const loadLineItemConfiguration = async () => {
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-acb28b15/config/line-item-fields`,
      {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      }
    );
    const data = await response.json();
    if (data.success) {
      setLineItemFields(data.data.sort((a, b) => a.order - b.order));
    }
  } catch (error) {
    console.error('Error loading line item configuration:', error);
  }
};

// Generate columns from configuration
const columns = lineItemFields
  .filter(field => field.visible)
  .map(field => ({
    id: field.name,
    header: field.displayName,
    width: field.width,
    editable: field.editable,
    type: field.type,
    required: field.required,
    calculated: field.calculated,
    formula: field.formula,
  }));
```

### Dynamic Cell Rendering

```typescript
const renderCell = (field: LineItemField, value: any, rowData: any) => {
  // If calculated, compute value
  if (field.calculated && field.formula) {
    value = evaluateFormula(field.formula, rowData);
  }
  
  // Render based on type
  switch (field.type) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return `${value}%`;
    case 'date':
      return formatDate(value);
    case 'checkbox':
      return <Checkbox checked={value} />;
    case 'select':
      return (
        <Select value={value}>
          {field.options?.map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </Select>
      );
    default:
      return field.editable ? (
        <Input 
          type={field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => updateCell(rowData.id, field.name, e.target.value)}
        />
      ) : (
        <span>{value}</span>
      );
  }
};
```

---

## Validation Logic

### Field Name Validation
```typescript
const validateFieldName = (name: string): boolean => {
  // Must start with letter or underscore
  // Can contain letters, numbers, underscores
  // No spaces or special characters
  const regex = /^[a-z_][a-z0-9_]*$/;
  return regex.test(name);
};
```

### Formula Validation
```typescript
const validateFormula = (formula: string, fields: LineItemField[]): {
  valid: boolean;
  error?: string;
} => {
  try {
    // Check if formula uses only existing fields
    const fieldNames = fields.map(f => f.name);
    const usedFields = formula.match(/[a-z_][a-z0-9_]*/g) || [];
    
    for (const used of usedFields) {
      if (!fieldNames.includes(used) && !Math[used]) {
        return {
          valid: false,
          error: `Field "${used}" not found`
        };
      }
    }
    
    // Try to evaluate with dummy data
    const context = {};
    fieldNames.forEach(name => context[name] = 1);
    new Function('context', `with(context) { return ${formula} }`)(context);
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid formula: ${error.message}`
    };
  }
};
```

### Circular Dependency Detection
```typescript
const detectCircularDependency = (
  field: LineItemField,
  allFields: LineItemField[]
): boolean => {
  if (!field.calculated || !field.formula) return false;
  
  const visited = new Set<string>();
  const stack = new Set<string>();
  
  const hasCycle = (fieldName: string): boolean => {
    if (stack.has(fieldName)) return true;
    if (visited.has(fieldName)) return false;
    
    visited.add(fieldName);
    stack.add(fieldName);
    
    const currentField = allFields.find(f => f.name === fieldName);
    if (currentField?.calculated && currentField.formula) {
      const dependencies = currentField.formula.match(/[a-z_][a-z0-9_]*/g) || [];
      for (const dep of dependencies) {
        if (hasCycle(dep)) return true;
      }
    }
    
    stack.delete(fieldName);
    return false;
  };
  
  return hasCycle(field.name);
};
```

---

## Testing Scenarios

### Test 1: Add New Field
1. Click "+ Add Field"
2. Enter name: `discount_percent`
3. Enter display: `Discount %`
4. Select type: `percent`
5. Check `Editable`
6. Click "Add Field"
7. **Verify**: Field appears in list
8. **Verify**: Field appears in quote line items

### Test 2: Edit Existing Field
1. Click "Edit" on `unit_price`
2. Change display name to `List Price`
3. Change width to `150`
4. Click "Update Field"
5. **Verify**: Changes reflected in configurator
6. **Verify**: Changes reflected in quote table

### Test 3: Delete Field
1. Click "Delete" on a field
2. Confirm deletion
3. **Verify**: Field removed from list
4. **Verify**: Field removed from quote table
5. **Verify**: Order numbers updated

### Test 4: Reorder Fields
1. Click "↑" on `quantity` field
2. **Verify**: Quantity moves above previous field
3. **Verify**: Order in quote table updates
4. **Verify**: Order numbers correct

### Test 5: Add Calculated Field
1. Add field: `line_margin`
2. Display: `Line Margin`
3. Type: `currency`
4. Check `Calculated`
5. Formula: `extended_price - (cost * quantity)`
6. **Verify**: Formula validates
7. **Verify**: Field calculates correctly

### Test 6: Validation
1. Try to add field with spaces in name
2. **Verify**: Error message shown
3. Try to add duplicate field name
4. **Verify**: Error message shown
5. Try invalid formula
6. **Verify**: Formula error shown

---

## Error Handling

### Display User-Friendly Errors

```typescript
const [error, setError] = useState<string | null>(null);

// Show error alert
{error && (
  <Alert variant="destructive" className="mb-4">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}

// Clear error after 5 seconds
useEffect(() => {
  if (error) {
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }
}, [error]);
```

### Handle API Errors

```typescript
const saveField = async () => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ field: newField }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      setError(data.error || 'Failed to save field');
      return;
    }
    
    // Success
    await loadFields();
    closeModal();
  } catch (error) {
    setError('Network error. Please try again.');
    console.error('Error saving field:', error);
  }
};
```

---

## Success Criteria

### ✅ Functional Requirements
- Users can add new fields dynamically
- Users can edit field properties
- Users can delete fields with confirmation
- Users can reorder fields
- Changes persist across sessions
- Changes reflect immediately in quote screen

### ✅ Technical Requirements
- TypeScript with proper types
- React functional components with hooks
- Supabase backend integration
- KV store for persistence
- Error handling and validation
- Responsive design

### ✅ User Experience
- Intuitive interface
- Clear visual feedback
- Confirmation dialogs for destructive actions
- Loading states during API calls
- Error messages with recovery options
- Help text and tooltips

---

## Additional Features (Optional)

### 1. Field Templates
Pre-configured sets of fields for different industries:
- Manufacturing
- Software/SaaS
- Services
- Retail

### 2. Import/Export
- Export configuration as JSON
- Import configuration from JSON
- Backup and restore

### 3. Field Groups
Organize fields into collapsible sections:
- Product Information
- Pricing
- Discounts
- Calculations

### 4. Advanced Formula Builder
- Visual formula builder
- Function selector
- Field picker
- Formula testing with sample data

### 5. Field History
- Track all changes to fields
- See who made changes and when
- Rollback to previous configuration

### 6. Field Usage Analytics
- Show which fields are most used
- Identify unused fields
- Track calculation performance

---

## Code Generation Prompt

To regenerate this component, use:

```
Create a Line Item Configurator component based on the technical specification in LineItemConfiguration.md. 

Requirements:
1. Create LineItemConfigurator.tsx component
2. Implement all CRUD operations (Create, Read, Update, Delete)
3. Add reorder functionality with up/down buttons
4. Include add/edit modal with all field properties
5. Validate field names and formulas
6. Integrate with backend API endpoints
7. Use the exact data structures and interfaces specified
8. Include proper error handling and loading states
9. Make it responsive and match the existing UI design
10. Add all backend endpoints to /supabase/functions/server/index.tsx

Follow the UI/UX specifications exactly, including:
- Card-based field display
- Modal form for add/edit
- Confirmation dialogs for delete
- Visual indicators for field types
- Icon usage as specified

Ensure integration with PricingTable so changes reflect immediately.
```

---

## Summary

This specification provides a complete blueprint for creating a dynamic Line Item Configurator that allows business users to customize quote line items without code changes. The system supports multiple field types, calculated fields, validation, reordering, and full CRUD operations with backend persistence via Supabase KV store.

**All technical details, data structures, UI designs, backend APIs, and integration points are fully specified for error-free generation.**
