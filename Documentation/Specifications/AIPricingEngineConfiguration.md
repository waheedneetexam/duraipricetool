# AI Pricing Engine Configuration - Technical Specification

## Overview

Create an **AI Pricing Engine** that uses OpenAI GPT-4o to interpret natural language pricing requirements from YAML templates and automatically configure quote header fields, line item fields, and calculation rules.

## Purpose

Enable non-technical business users to define complex pricing logic by filling out a structured template in plain English, which AI then translates into executable pricing configurations.

---

## Technical Requirements

### Component Location
- **Main Component**: `/src/app/components/AIPricingEngine.tsx`
- **Sub-components**: 
  - Template editor modal
  - Processing status display
  - Results preview
  - Settings panel
- **Backend**: `/supabase/functions/server/index.tsx` (AI processing endpoints)

### Dependencies
```typescript
import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Upload, Download, Settings, Play, CheckCircle, 
  AlertCircle, Zap, FileText, Code, Brain, Loader
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { projectId, publicAnonKey } from '/utils/supabase/info';
```

---

## YAML Template Structure

### Complete Template Format

```yaml
# Pricing Requirements Template
# Fill out this template with your business requirements

company_info:
  name: "Acme Corporation"
  industry: "Software/SaaS"
  pricing_model: "Subscription with volume discounts"

quote_header_fields:
  - name: "customer_id"
    display: "Customer"
    type: "text"
    required: true
    description: "Customer identifier"
  
  - name: "quote_date"
    display: "Quote Date"
    type: "date"
    required: true
    description: "Date quote was created"
  
  - name: "total_amount"
    display: "Total Amount"
    type: "currency"
    calculated: true
    description: "Sum of all line item extended prices"
    logic: "Sum all line item extended_price values"

line_item_fields:
  - name: "product_sku"
    display: "Product SKU"
    type: "text"
    required: true
    description: "Product identifier"
  
  - name: "quantity"
    display: "Quantity"
    type: "number"
    required: true
    default_value: 1
    description: "Number of units"
  
  - name: "unit_price"
    display: "Unit Price"
    type: "currency"
    required: true
    description: "Price per unit"
    logic: |
      Look up standard_price from products table by product_sku.
      If customer_segment is Enterprise, apply 15% discount.
      If quantity > 100, apply additional 10% volume discount.
  
  - name: "extended_price"
    display: "Extended Price"
    type: "currency"
    calculated: true
    description: "Total price for this line"
    logic: "quantity * unit_price"

pricing_rules:
  - name: "volume_discount"
    description: "Apply tiered volume discounts"
    logic: |
      If total quantity across all line items > 1000:
        Apply 20% discount to all line items
      Else if total quantity > 500:
        Apply 15% discount to all line items
      Else if total quantity > 100:
        Apply 10% discount to all line items
  
  - name: "customer_segment_pricing"
    description: "Different pricing for customer segments"
    logic: |
      Look up customer_segment from customers table by customer_id.
      Enterprise customers get list_price * 0.85
      Mid-market customers get list_price * 0.90
      SMB customers get list_price * 0.95
  
  - name: "margin_validation"
    description: "Ensure minimum margin percentage"
    logic: |
      For each line item:
        Calculate margin = (unit_price - cost) / unit_price * 100
        If margin < 20%, flag as warning
        If margin < 10%, flag as error and require approval

table_dependencies:
  - name: "products"
    description: "Product catalog with SKU, name, cost, standard price"
    required_columns: ["product_sku", "product_name", "standard_price", "cost"]
  
  - name: "customers"
    description: "Customer master data"
    required_columns: ["customer_id", "customer_name", "customer_segment"]
  
  - name: "volume_discounts"
    description: "Volume discount tiers"
    required_columns: ["min_quantity", "max_quantity", "discount_percent"]

calculation_priorities:
  - field: "unit_price"
    priority: 1
    reason: "Must be calculated before extended_price"
  
  - field: "extended_price"
    priority: 2
    reason: "Depends on unit_price and quantity"
  
  - field: "total_amount"
    priority: 3
    reason: "Depends on all line item extended_price values"

special_requirements:
  - "All currency values should be rounded to 2 decimal places"
  - "Discounts cannot be stacked beyond 50% total"
  - "Quotes over $100,000 require manager approval"
  - "Customer segment must be validated before pricing"
```

### Minimal Template (Starter)

```yaml
company_info:
  name: "My Company"
  industry: "General"

quote_header_fields:
  - name: "customer_name"
    display: "Customer Name"
    type: "text"
    required: true

line_item_fields:
  - name: "product_name"
    display: "Product"
    type: "text"
    required: true
  
  - name: "quantity"
    display: "Qty"
    type: "number"
    required: true
    default_value: 1
  
  - name: "unit_price"
    display: "Unit Price"
    type: "currency"
    required: true
  
  - name: "extended_price"
    display: "Total"
    type: "currency"
    calculated: true
    logic: "quantity * unit_price"

pricing_rules: []

table_dependencies: []
```

---

## Component Structure

### Main Component States

```typescript
interface AIPricingEngineState {
  template: string;
  processing: boolean;
  processedResults: ProcessedConfiguration | null;
  errors: ValidationError[];
  apiKey: string;
  showSettings: boolean;
  activeTab: 'editor' | 'results' | 'settings';
}

interface ProcessedConfiguration {
  headerFields: HeaderField[];
  lineItemFields: LineItemField[];
  calculationRules: CalculationRule[];
  tableDependencies: TableDependency[];
  validationErrors: ValidationError[];
  summary: string;
  confidence: number; // 0-100
}

interface ValidationError {
  type: 'missing_table' | 'invalid_logic' | 'syntax_error' | 'missing_dependency';
  field?: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion: string;
}

interface CalculationRule {
  id: string;
  name: string;
  description: string;
  type: 'header' | 'line_item' | 'aggregate';
  fieldName: string;
  formula: string;
  priority: number;
  dependencies: string[];
  generatedCode: string;
}
```

### UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│ 🤖 AI Pricing Engine                         [Settings] [?]  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  [Editor] [Results] [Settings]                               │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ YAML Template Editor                                   │  │
│  │                                                         │  │
│  │ company_info:                                          │  │
│  │   name: "Acme Corp"                                    │  │
│  │   industry: "Software"                                 │  │
│  │                                                         │  │
│  │ quote_header_fields:                                   │  │
│  │   - name: "customer_id"                                │  │
│  │     display: "Customer"                                │  │
│  │     type: "text"                                       │  │
│  │                                                         │  │
│  │ line_item_fields:                                      │  │
│  │   - name: "quantity"                                   │  │
│  │     type: "number"                                     │  │
│  │     logic: "User enters quantity"                      │  │
│  │                                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  [📥 Load Template] [💾 Save Template] [✨ Process with AI]  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ℹ️ Processing Status                                    │  │
│  │                                                         │  │
│  │ ⏳ Analyzing requirements...                           │  │
│  │ ✅ Header fields configured (5 fields)                 │  │
│  │ ✅ Line item fields configured (8 fields)              │  │
│  │ ⏳ Generating calculation rules...                     │  │
│  │ ⚠️  Warning: Table "volume_discounts" not found        │  │
│  │                                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## AI Processing Workflow

### Step-by-Step Process

```
1. User fills YAML template
         ↓
2. Click "Process with AI"
         ↓
3. Frontend sends template to backend
         ↓
4. Backend calls OpenAI GPT-4o
         ↓
5. AI analyzes requirements:
   - Parses YAML structure
   - Identifies all fields
   - Extracts pricing logic
   - Determines dependencies
   - Generates formulas
   - Creates calculation order
         ↓
6. Backend validates AI output:
   - Check table references
   - Verify field names
   - Validate formulas
   - Detect circular dependencies
         ↓
7. Return structured configuration
         ↓
8. Frontend displays results
         ↓
9. User reviews and applies
         ↓
10. Configuration saved to database
```

---

## Backend API Endpoints

### 1. Process Pricing Requirements

```typescript
POST /make-server-acb28b15/ai-pricing/process

Request Body:
{
  template: string;  // YAML template content
  validateTables: boolean;  // Check if tables exist
}

Response:
{
  success: boolean;
  data: {
    headerFields: HeaderField[];
    lineItemFields: LineItemField[];
    calculationRules: CalculationRule[];
    tableDependencies: string[];
    validationErrors: ValidationError[];
    summary: string;
    processingTime: number;  // milliseconds
  };
  error?: string;
}
```

### 2. Save Configuration

```typescript
POST /make-server-acb28b15/ai-pricing/save

Request Body:
{
  configuration: ProcessedConfiguration;
  overwrite: boolean;  // Overwrite existing config
}

Response:
{
  success: boolean;
  message: string;
}
```

### 3. Get Current Configuration

```typescript
GET /make-server-acb28b15/ai-pricing/current

Response:
{
  success: boolean;
  data: {
    template: string;
    configuration: ProcessedConfiguration;
    lastUpdated: string;
  };
}
```

### 4. Validate Template

```typescript
POST /make-server-acb28b15/ai-pricing/validate

Request Body:
{
  template: string;
}

Response:
{
  success: boolean;
  valid: boolean;
  errors: ValidationError[];
}
```

### 5. API Key Management

```typescript
POST /make-server-acb28b15/ai-pricing/settings/api-key

Request Body:
{
  apiKey: string;
}

Response:
{
  success: boolean;
  message: string;
}

GET /make-server-acb28b15/ai-pricing/settings/api-key

Response:
{
  success: boolean;
  hasKey: boolean;  // Don't return actual key
  keyPrefix?: string;  // e.g., "sk-...abc"
}
```

---

## Backend Implementation

### OpenAI Integration

```typescript
app.post("/make-server-acb28b15/ai-pricing/process", async (c) => {
  try {
    const { template, validateTables = true } = await c.req.json();
    
    // Get OpenAI API key from settings
    const apiKey = await kv.get("config:openai_api_key");
    if (!apiKey) {
      return c.json({ 
        success: false, 
        error: "OpenAI API key not configured. Please add it in Settings." 
      }, 400);
    }
    
    console.log("Processing pricing requirements with AI...");
    const startTime = Date.now();
    
    // Parse YAML template
    let parsedTemplate;
    try {
      parsedTemplate = parseYAML(template);
    } catch (error) {
      return c.json({
        success: false,
        error: `YAML parsing error: ${error.message}`
      }, 400);
    }
    
    // Get available tables for validation
    const availableTables = await kv.keys("table:");
    const tableNames = availableTables.map(key => key.split(':')[1]);
    
    // Build AI prompt
    const prompt = buildAIPrompt(parsedTemplate, tableNames);
    
    // Call OpenAI GPT-4o
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });
    
    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error("OpenAI API error:", errorData);
      return c.json({
        success: false,
        error: `AI processing failed: ${openaiResponse.status}`
      }, 500);
    }
    
    const aiData = await openaiResponse.json();
    const result = JSON.parse(aiData.choices[0].message.content);
    
    // Validate table references
    const validationErrors: ValidationError[] = [];
    if (validateTables) {
      for (const tableName of result.tableDependencies || []) {
        if (!tableNames.includes(tableName)) {
          validationErrors.push({
            type: 'missing_table',
            message: `Table "${tableName}" not found in database`,
            severity: 'error',
            suggestion: `Create the "${tableName}" table or import data via CSV in the Admin tab`
          });
        }
      }
    }
    
    // Add validation errors to result
    result.validationErrors = [
      ...(result.validationErrors || []),
      ...validationErrors
    ];
    
    const processingTime = Date.now() - startTime;
    console.log(`AI processing completed in ${processingTime}ms`);
    
    // Save results
    await kv.set("config:ai_processed", {
      template,
      configuration: result,
      timestamp: new Date().toISOString(),
      processingTime
    });
    
    return c.json({
      success: true,
      data: {
        ...result,
        processingTime
      }
    });
    
  } catch (error) {
    console.error("Error processing pricing requirements:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
```

### AI System Prompt

```typescript
const SYSTEM_PROMPT = `You are an expert pricing configuration system that converts natural language business requirements into structured pricing configurations.

Your task is to analyze a YAML template containing pricing requirements and generate:
1. Header field configurations
2. Line item field configurations  
3. Calculation rules with executable JavaScript code
4. Table dependencies
5. Validation and error detection

Return valid JSON with this structure:
{
  "headerFields": [
    {
      "id": "unique_id",
      "name": "field_name",
      "displayName": "Field Label",
      "type": "text|number|currency|date|select",
      "required": boolean,
      "editable": boolean,
      "calculated": boolean,
      "formula": "javascript formula if calculated",
      "defaultValue": any,
      "description": "help text",
      "order": number
    }
  ],
  "lineItemFields": [...same structure...],
  "calculationRules": [
    {
      "id": "rule_id",
      "name": "rule_name",
      "description": "what this rule does",
      "type": "header|line_item|aggregate",
      "fieldName": "target_field",
      "formula": "plain english description",
      "generatedCode": "executable JavaScript function",
      "priority": number,
      "dependencies": ["field1", "field2"]
    }
  ],
  "tableDependencies": ["table1", "table2"],
  "validationErrors": [
    {
      "type": "missing_table|invalid_logic|syntax_error",
      "field": "field_name",
      "message": "error description",
      "severity": "error|warning",
      "suggestion": "how to fix"
    }
  ],
  "summary": "Natural language summary of the configuration",
  "confidence": 85
}

Guidelines:
- Generate production-ready JavaScript code
- Use proper error handling
- Include comments in generated code
- Detect circular dependencies
- Validate all table and field references
- Assign proper calculation priorities
- Use clear, descriptive names
- Follow the field type conventions
- Ensure formulas are syntactically correct
- Return confidence score (0-100) based on clarity of requirements
`;
```

### Save Configuration Endpoint

```typescript
app.post("/make-server-acb28b15/ai-pricing/save", async (c) => {
  try {
    const { configuration, overwrite = false } = await c.req.json();
    
    // Check if configuration already exists
    const existing = await kv.get("config:header_fields");
    if (existing && !overwrite) {
      return c.json({
        success: false,
        error: "Configuration already exists. Set overwrite=true to replace."
      }, 400);
    }
    
    // Save header fields
    if (configuration.headerFields) {
      await kv.set("config:header_fields", configuration.headerFields);
    }
    
    // Save line item fields
    if (configuration.lineItemFields) {
      await kv.set("config:line_item_fields", configuration.lineItemFields);
    }
    
    // Save calculation rules
    if (configuration.calculationRules) {
      await kv.set("config:calculation_rules", configuration.calculationRules);
    }
    
    console.log("AI-generated configuration saved successfully");
    
    return c.json({
      success: true,
      message: "Configuration saved successfully"
    });
    
  } catch (error) {
    console.error("Error saving configuration:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
```

---

## Frontend Component Implementation

### Main Component Structure

```typescript
export function AIPricingEngine({ onBack }: { onBack: () => void }) {
  const [template, setTemplate] = useState<string>(DEFAULT_TEMPLATE);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessedConfiguration | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'results' | 'settings'>('editor');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    checkApiKey();
    loadLastTemplate();
  }, []);

  const processWithAI = async () => {
    if (!hasApiKey) {
      alert('Please configure OpenAI API key in Settings tab');
      setActiveTab('settings');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-acb28b15/ai-pricing/process`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ template, validateTables: true }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setResults(data.data);
        setActiveTab('results');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error processing:', error);
      alert('Failed to process template');
    } finally {
      setProcessing(false);
    }
  };

  const saveConfiguration = async () => {
    if (!results) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-acb28b15/ai-pricing/save`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ configuration: results, overwrite: true }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        alert('Configuration saved successfully!');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save configuration');
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Sparkles className="w-6 h-6" />
          AI Pricing Engine
        </h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="editor">Template Editor</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="editor">
          {/* Template editor UI */}
        </TabsContent>

        <TabsContent value="results">
          {/* Results display UI */}
        </TabsContent>

        <TabsContent value="settings">
          {/* Settings UI */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Template Examples

### Example 1: Simple Product Pricing

```yaml
company_info:
  name: "ABC Products"
  industry: "Manufacturing"

line_item_fields:
  - name: "product_id"
    display: "Product"
    type: "text"
    required: true
    logic: "User selects from product catalog"
  
  - name: "quantity"
    display: "Qty"
    type: "number"
    required: true
    default_value: 1
  
  - name: "unit_price"
    display: "Price"
    type: "currency"
    required: true
    logic: "Look up from products table by product_id"
  
  - name: "total"
    display: "Total"
    type: "currency"
    calculated: true
    logic: "quantity * unit_price"
```

### Example 2: Volume Discount Model

```yaml
line_item_fields:
  - name: "discount_percent"
    display: "Discount %"
    type: "percent"
    calculated: true
    logic: |
      Look up discount from volume_discounts table where:
      - quantity is between min_qty and max_qty
      Return discount_percent
  
  - name: "discounted_price"
    display: "Discounted Price"
    type: "currency"
    calculated: true
    logic: "unit_price * (1 - discount_percent / 100)"
```

### Example 3: Customer Segment Pricing

```yaml
pricing_rules:
  - name: "segment_pricing"
    logic: |
      Get customer_segment from customers table
      If Enterprise: multiply all prices by 0.80
      If Mid-Market: multiply all prices by 0.90
      If SMB: use standard prices
```

---

## Testing & Validation

### Test Scenarios

1. **Valid Template Processing**
   - Input: Complete YAML template
   - Expected: All fields configured correctly
   - Verify: No validation errors

2. **Invalid Table Reference**
   - Input: Template referencing non-existent table
   - Expected: Validation error with suggestion
   - Verify: Error displayed to user

3. **Circular Dependency**
   - Input: Field A depends on B, B depends on A
   - Expected: Circular dependency detected
   - Verify: Clear error message

4. **Complex Formula**
   - Input: Multi-step calculation logic
   - Expected: Correct JavaScript code generated
   - Verify: Formula executes correctly

5. **API Key Management**
   - Input: Save API key
   - Expected: Key stored securely
   - Verify: Masked display, working AI calls

---

## Success Criteria

✅ Users can write pricing requirements in plain English
✅ AI accurately interprets requirements  
✅ Generated configurations are valid and executable
✅ Table validation catches missing dependencies
✅ Formulas are syntactically correct
✅ Circular dependencies are detected
✅ Configuration can be saved and applied
✅ Changes reflect in quote interface
✅ Error messages are clear and actionable
✅ Processing completes within 10 seconds

---

## Code Generation Prompt

```
Create an AI Pricing Engine component based on AIPricingEngineConfiguration.md.

Requirements:
1. Create AIPricingEngine.tsx with template editor, results display, and settings
2. Implement YAML template parsing
3. Add OpenAI GPT-4o integration in backend
4. Include table validation against existing data
5. Generate executable JavaScript code for formulas
6. Detect circular dependencies
7. Provide clear error messages with suggestions
8. Add API key management with secure storage
9. Create comprehensive results preview
10. Enable one-click configuration save

Follow all data structures, API endpoints, and UI specifications exactly as documented.
```

---

This specification provides complete technical details for building an AI-powered pricing configuration system that translates natural language requirements into executable pricing logic.
