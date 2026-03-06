# Field Logic Manager - Complete Guide

## Overview

The **Field Logic Manager** is an advanced AI-powered system that allows you to define detailed pricing logic for individual fields using plain English. The system validates table references, generates executable code, and provides iterative error correction until your logic is perfect.

## Key Features

### 🤖 AI-Powered Analysis
- **GPT-4o** interprets your plain English descriptions
- Understands complex business logic with multiple conditions
- Generates production-ready JavaScript/TypeScript code
- Provides clear explanations of what it understood

### ✅ Comprehensive Validation
- **Table Validation**: Checks if referenced tables exist in your database
- **Column Validation**: Verifies columns exist in referenced tables  
- **Syntax Validation**: Ensures logic can be converted to executable code
- **Dependency Detection**: Identifies circular dependencies

### 🔄 Iterative Error Correction
- **Detailed Error Messages**: Clear descriptions of what went wrong
- **Actionable Suggestions**: Specific guidance on how to fix issues
- **Multiple Error Types**: Missing tables, missing columns, syntax errors, circular dependencies
- **Severity Levels**: Errors block saving, warnings allow saving

### 💾 Permanent Logic Storage
- **Version Control**: Each change creates a new version
- **Logic History**: Track changes over time
- **Reusable Logic**: Apply the same logic across multiple fields
- **Atomic Updates**: Logic only saves when fully validated

## How It Works

### Workflow

```
1. Select Field → 2. Write Logic → 3. AI Validates → 4. Fix Errors (if any) → 5. Save
                                           ↓                  ↑
                                      Errors Found? ────────┘
                                           ↓ No
                                    Logic Saved ✓
```

### 1. Select a Field

Navigate to **Admin → Field Logic Manager** and choose:
- **Header Fields**: Deal-level calculations (total price, overall discount, etc.)
- **Line Item Fields**: Line-level calculations (unit price, extended price, margin, etc.)

### 2. Write Logic in Plain English

Describe exactly what you want to calculate using natural language.

**Example:**
```
Look up the "discount_percent" from the "volume_discounts" table 
where the "quantity" is between "min_qty" and "max_qty". 
Then calculate: final_price = list_price * (1 - discount_percent / 100) * quantity.
```

### 3. AI Validation

Click **"Validate & Generate Code"** and the AI will:
- Parse your logic
- Identify all table and column references
- Check if they exist in your database
- Generate executable code
- Report any errors with suggestions

### 4. Review Results

**If Valid:**
- ✅ Green success message
- 📊 AI explanation of what it understood
- 📁 List of table dependencies
- 💻 Generated executable code
- 💾 "Save Logic" button enabled

**If Errors:**
- ❌ Red error message
- 📋 List of all issues found
- 💡 Suggestions for each error
- ⚠️ Severity indicators (error/warning)

### 5. Fix Errors and Retry

Read the suggestions and update your logic accordingly, then validate again. Repeat until all errors are fixed.

### 6. Save Permanent Logic

Once validated, click **"Save Logic"** to permanently store the logic. It will now execute automatically when calculating that field.

## Writing Effective Logic

### Table Lookups

#### Simple Lookup
```
Look up "standard_price" from the "products" table where "product_sku" matches this line item's SKU.
```

#### Conditional Lookup
```
Look up "discount_percent" from "segment_discounts" table 
where "segment" equals header.customer_segment.
```

#### Range-Based Lookup
```
Find the tier in "volume_discounts" table where quantity 
is between "min_quantity" and "max_quantity", then use the "discount_percent".
```

### Multiple Table Lookups

```
First, look up "customer_tier" from the "customers" table 
where "customer_id" matches header.customer_id.

Then, look up "tier_discount" from the "discount_tiers" table 
where "tier" equals the customer_tier found in step 1.

Finally, calculate: discounted_price = list_price * (1 - tier_discount / 100).
```

### Formulas

#### Basic Arithmetic
```
Calculate extended_price = unit_price * quantity
```

#### Percentage Calculations
```
Calculate: margin_percent = ((price - cost) / price) * 100
```

#### Conditional Formulas
```
If quantity > 100, apply 15% discount.
If quantity > 50, apply 10% discount.
If quantity > 10, apply 5% discount.
Otherwise, no discount.

Calculate: final_price = list_price * (1 - discount / 100) * quantity
```

### Complex Logic

```
1. Look up "base_cost" from "product_costs" table by product_sku
2. Look up "freight_rate" from "freight_rates" table by shipping_region
3. Look up "handling_fee" from "handling_fees" table by product_category
4. Calculate total_cost = (base_cost + handling_fee) * quantity + (freight_rate * weight)
5. Calculate margin = selling_price - total_cost
6. Calculate margin_percent = (margin / selling_price) * 100
7. If margin_percent < 20, set warning flag
```

## Examples by Use Case

### Volume Discount Pricing

**Scenario**: Apply tiered discounts based on quantity

**Logic**:
```
Look up the discount tier from the "volume_discounts" table where:
- product_category matches this item's category
- quantity is between tier_min_qty and tier_max_qty

Apply the tier's discount_percent to calculate:
discounted_price = list_price * (1 - discount_percent / 100)
extended_price = discounted_price * quantity
```

**Tables Needed**:
- `volume_discounts` with columns: `product_category`, `tier_min_qty`, `tier_max_qty`, `discount_percent`

### Customer Segment Pricing

**Scenario**: Different prices for Enterprise vs SMB customers

**Logic**:
```
Look up customer_segment from "customers" table where customer_id = header.customer_id.

If customer_segment = "Enterprise":
  Look up enterprise_price from "enterprise_pricing" table by product_sku
  Use enterprise_price as the unit_price
Else if customer_segment = "SMB":
  Look up smb_price from "smb_pricing" table by product_sku
  Use smb_price as the unit_price
Else:
  Use standard list_price

Calculate extended_price = unit_price * quantity
```

**Tables Needed**:
- `customers` with columns: `customer_id`, `customer_segment`
- `enterprise_pricing` with columns: `product_sku`, `enterprise_price`
- `smb_pricing` with columns: `product_sku`, `smb_price`

### Cost-Plus Margin Calculation

**Scenario**: Calculate price based on cost + target margin

**Logic**:
```
Look up base_cost from "product_costs" table where product_sku matches this item's SKU.

Look up target_margin_percent from "margin_targets" table where:
- product_category matches this item's category
- customer_segment matches header.customer_segment

Calculate required_price = base_cost / (1 - target_margin_percent / 100)
Calculate extended_price = required_price * quantity
Calculate actual_margin = extended_price - (base_cost * quantity)
Calculate actual_margin_percent = (actual_margin / extended_price) * 100
```

**Tables Needed**:
- `product_costs` with columns: `product_sku`, `base_cost`
- `margin_targets` with columns: `product_category`, `customer_segment`, `target_margin_percent`

### Regional Pricing

**Scenario**: Different prices based on customer location

**Logic**:
```
Look up customer region from "customers" table by customer_id.
Look up regional_multiplier from "regional_pricing" table by region.
Look up base_price from "products" table by product_sku.

Calculate regional_price = base_price * regional_multiplier
Calculate extended_price = regional_price * quantity
```

**Tables Needed**:
- `customers` with columns: `customer_id`, `region`
- `regional_pricing` with columns: `region`, `regional_multiplier`
- `products` with columns: `product_sku`, `base_price`

### Bundle Pricing

**Scenario**: Discount when buying product bundles

**Logic**:
```
Look up this product's bundle_group from "product_bundles" table.

Count how many line items in this quote have the same bundle_group.

If bundle count >= 3:
  Apply 20% bundle discount
Else if bundle count >= 2:
  Apply 10% bundle discount
Else:
  No bundle discount

Calculate: final_price = list_price * (1 - bundle_discount / 100) * quantity
```

**Tables Needed**:
- `product_bundles` with columns: `product_sku`, `bundle_group`

## Validation Error Types

### Missing Table Error

**Example Error**:
```
❌ MISSING_TABLE
Table "volume_discounts" does not exist in the database

Suggestion: Available tables are: products, customers, sales_orgs. 
Please use one of these or create the "volume_discounts" table first.
```

**How to Fix**:
- Check table name spelling
- Ensure table exists in your database
- Import data for that table via CSV
- Use one of the available tables instead

### Missing Column Error

**Example Error**:
```
❌ MISSING_COLUMN
Column "discount_percent" does not exist in table "volume_discounts"

Suggestion: Available columns in "volume_discounts": id, tier_name, min_qty, max_qty, discount_rate
```

**How to Fix**:
- Check column name spelling
- Review the table schema to see available columns
- Update your logic to use the correct column name
- If needed, update your CSV data to include the column

### Syntax Error

**Example Error**:
```
❌ SYNTAX_ERROR
Cannot parse the calculation formula

Suggestion: Ensure formulas follow the pattern: 
result = expression (e.g., total = price * quantity)
```

**How to Fix**:
- Review formula syntax
- Use simple mathematical expressions
- Break complex formulas into multiple steps
- Use clear variable names

### Circular Dependency

**Example Error**:
```
❌ CIRCULAR_DEPENDENCY
Field "final_price" depends on "discount_amount" which depends on "final_price"

Suggestion: Reorder your calculations to avoid circular references
```

**How to Fix**:
- Review the dependency chain
- Reorder calculation steps
- Use intermediate variables
- Break the circular reference

## Best Practices

### 1. Be Specific
❌ Bad: "Apply discount to price"
✅ Good: "Look up discount_percent from volume_discounts table where quantity is between min_qty and max_qty, then calculate: final_price = list_price * (1 - discount_percent / 100)"

### 2. Use Exact Names
- Always use quotes around table and column names
- Match case exactly (though AI is somewhat flexible)
- Use the full table name, not abbreviations

### 3. Break Down Complex Logic
Instead of one giant paragraph:
```
Step 1: Look up customer tier
Step 2: Look up tier discount
Step 3: Look up volume discount
Step 4: Combine discounts
Step 5: Calculate final price
```

### 4. Reference Other Fields Clearly
- Header fields: `header.customer_id`
- Current line item fields: `this.product_sku` or just `product_sku`
- Other line items: Specify clearly in logic

### 5. Handle Edge Cases
```
If the table lookup returns no results, use default value of 0.
If quantity is 0 or negative, set price to 0.
```

### 6. Test Iteratively
- Start with simple logic
- Validate and fix errors
- Add complexity incrementally
- Validate again after each addition

### 7. Document Assumptions
```
Assumption: All products in "volume_discounts" table are kept up to date.
Assumption: freight_rate is per unit of weight.
```

## Integration with Quotes

### How Logic Executes

When a quote is created or updated:

1. **Field Dependencies Resolved**: System determines calculation order
2. **Table Data Loaded**: Required tables are loaded into memory
3. **Logic Executed**: Generated code runs for each field
4. **Results Cached**: Calculated values stored in quote
5. **Validation Run**: Business rules checked
6. **Quote Saved**: Final calculated quote persisted

### Field Dependencies

The system automatically manages dependencies:

```
quantity (user input)
  ↓
volume_discount_percent (calculated from quantity)
  ↓
discounted_unit_price (calculated from volume_discount_percent)
  ↓
extended_price (calculated from discounted_unit_price and quantity)
```

### Performance Considerations

- **Table Caching**: Tables loaded once per quote calculation
- **Lazy Evaluation**: Only calculated fields that changed
- **Dependency Optimization**: Minimal recalculation
- **Parallel Processing**: Independent fields calculated in parallel

## Troubleshooting

### Logic Not Executing

**Problem**: Saved logic but field still shows old value

**Solutions**:
1. Refresh the quote page
2. Check validation status is "valid"
3. Review generated code for errors
4. Check browser console for execution errors

### Incorrect Results

**Problem**: Logic executes but gives wrong values

**Solutions**:
1. Review the AI-generated code
2. Check table data is correct
3. Verify column references are accurate
4. Test with simple data first
5. Add logging to generated code

### Slow Performance

**Problem**: Quote calculations taking too long

**Solutions**:
1. Reduce number of table lookups
2. Cache frequently accessed data
3. Simplify complex formulas
4. Consider precomputing values

### API Key Issues

**Problem**: "API key not configured" error

**Solutions**:
1. Go to AI Pricing Engine → Settings
2. Add your OpenAI API key
3. Ensure key has valid credits
4. Check key hasn't been revoked

## Advanced Features

### Version Control

Each save creates a new version:
- Version 1: Initial logic
- Version 2: Updated discount calculation
- Version 3: Added edge case handling

View version history in the field card.

### Logic Reuse

Copy successful logic patterns:
1. View existing field logic
2. Copy the plain text description
3. Adapt for new field
4. Validate and save

### Bulk Operations

Apply similar logic to multiple fields:
1. Create template logic
2. Use variables for field names
3. Validate once
4. Apply to all relevant fields

### Testing

Test logic before deploying:
1. Create test quote
2. Add test line items
3. Verify calculations
4. Fix any issues
5. Deploy to production

## Technical Details

### Generated Code Format

The AI generates JavaScript functions like:

```javascript
// Calculate volume discount percentage
function calculateVolumeDiscountPercent(context, tableData) {
  const quantity = context.quantity;
  const volumeDiscounts = tableData['volume_discounts'];
  
  // Find matching tier
  const tier = volumeDiscounts.find(t => 
    quantity >= t.min_qty && quantity <= t.max_qty
  );
  
  // Return discount or default to 0
  return tier ? tier.discount_percent : 0;
}
```

### Execution Context

Available variables in execution context:
- `context`: Current field values
- `tableData`: All referenced table data
- `header`: Header-level fields
- `lineItems`: All line items in quote

### Security

- **Sandboxed Execution**: Code runs in isolated environment
- **No External Access**: Cannot access external APIs
- **Read-Only Tables**: Cannot modify table data
- **Timeout Protection**: Long-running code is terminated

## FAQ

**Q: Can I reference fields from other line items?**
A: Yes, but be careful about circular dependencies. Access via `context.lineItems` array.

**Q: How many tables can I reference?**
A: No hard limit, but recommend keeping it under 5 for performance.

**Q: Can I use custom functions?**
A: Not directly, but you can describe complex logic and AI will generate appropriate code.

**Q: What if my table structure changes?**
A: Re-validate your logic. The system will detect missing columns and prompt for updates.

**Q: Can I export/import logic?**
A: Currently logic is stored per field. Feature request for import/export is noted.

**Q: Does this work offline?**
A: No, requires OpenAI API connection for validation. Execution works offline.

**Q: What's the cost?**
A: Based on OpenAI API usage. Validation is approximately $0.01-0.05 per field.

---

**Ready to build intelligent pricing logic?** Head to **Admin → Field Logic Manager** and start defining your first field!
