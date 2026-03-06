# AI Pricing Engine - Complete Guide

## Overview

The AI Pricing Engine is a next-generation intelligent pricing configuration system that uses advanced AI (GPT-4) to interpret your business requirements and automatically configure your quote management system.

## How It Works

1. **Fill Out Template** - Describe your pricing logic in a structured YAML template
2. **AI Processing** - GPT-4 analyzes and interprets your requirements
3. **Review Configuration** - AI generates field configs and calculation rules
4. **Apply to System** - One-click deployment to your quote system

## Features

### What the AI Can Configure

- ✅ **Quote Header Fields** - Customer segment, deal size, discount totals, etc.
- ✅ **Line Item Fields** - Product SKU, quantity, pricing, discounts, margins
- ✅ **Pricing Logic** - Volume discounts, segment pricing, tiered pricing
- ✅ **Calculation Rules** - Price formulas, margin calculations, aggregations
- ✅ **Validation Rules** - Business constraints, minimum margins, max discounts
- ✅ **Approval Workflows** - Conditional approval requirements

### AI Capabilities

The system uses **OpenAI GPT-4o** to:
- Interpret natural language business rules
- Extract field configurations from descriptions
- Convert pricing logic into executable formulas
- Generate validation and approval rules
- Provide explanations of the interpreted logic

## Template Structure

### 1. Company Information
```yaml
company_name: "Your Company Name"
industry: "Your Industry"
pricing_model: "Your Pricing Model"
```

### 2. Header Fields Configuration
```yaml
header_fields:
  - name: "field_name"
    type: "select|currency|percent|number|string|date|boolean"
    options: ["Option1", "Option2"]  # For select fields
    required: true|false
    calculated: true|false
    description: "Field description"
    default: "default value"
```

**Supported Types:**
- `string` - Text fields
- `number` - Numeric values
- `currency` - Money values (formatted with $)
- `percent` - Percentage values
- `date` - Date fields
- `select` - Dropdown selection
- `boolean` - Yes/No fields

### 3. Line Item Fields Configuration
```yaml
line_item_fields:
  - name: "field_name"
    type: "string|number|currency|percent"
    required: true|false
    calculated: true|false
    description: "Field description"
    min: 1  # For numeric fields
    max: 100  # For numeric fields
```

### 4. Pricing Logic

#### Volume Discounts
```yaml
volume_discounts:
  rule: "Quantity-based tiered discounts"
  tiers:
    - quantity_from: 1
      quantity_to: 10
      discount: 0
    - quantity_from: 11
      quantity_to: 50
      discount: 5
    - quantity_from: 51
      quantity_to: null  # null = infinity
      discount: 10
```

#### Customer Segment Discounts
```yaml
segment_discounts:
  rule: "Additional discount based on customer segment"
  Enterprise: 10
  Mid-Market: 5
  SMB: 0
```

#### Price Calculations
```yaml
price_calculation:
  step_1: "Apply volume discount to list price"
  formula_1: "discounted_price = list_price * (1 - volume_discount_percent / 100)"
  
  step_2: "Apply segment discount"
  formula_2: "final_unit_price = discounted_price * (1 - segment_discount_percent / 100)"
  
  step_3: "Calculate extended price"
  formula_3: "extended_price = final_unit_price * quantity"
  
  step_4: "Calculate margin"
  formula_4: "total_cost = cost * quantity"
  formula_5: "margin_amount = extended_price - total_cost"
  formula_6: "margin_percent = (margin_amount / extended_price) * 100"
```

#### Header Calculations
```yaml
header_calculations:
  deal_size:
    description: "Sum of all line item extended prices"
    formula: "SUM(line_items.extended_price)"
  
  total_discount_percent:
    description: "Weighted average discount"
    formula: "WEIGHTED_AVG(line_items.discount, line_items.extended_price)"
```

### 5. Validation Rules
```yaml
validation_rules:
  - rule: "Minimum margin requirement"
    condition: "margin_percent >= 20"
    error_message: "Margin must be at least 20%"
    level: "warning"
  
  - rule: "Maximum total discount"
    condition: "(volume_discount + segment_discount) <= 25"
    error_message: "Total discount cannot exceed 25%"
    level: "error"
```

**Validation Levels:**
- `warning` - Shows warning but allows save
- `error` - Blocks save until fixed

### 6. Approval Workflow Rules
```yaml
approval_rules:
  - condition: "margin_percent < 25"
    approver: "Sales Manager"
    reason: "Low margin approval required"
  
  - condition: "deal_size > 100000"
    approver: "VP of Sales"
    reason: "Large deal approval required"
```

### 7. Business Context
```yaml
business_context: |
  Provide context about your business model, pricing strategy,
  special considerations, and any industry-specific requirements.

special_instructions: |
  - Specific formatting requirements
  - Rounding rules
  - Edge cases to handle
  - Integration requirements
```

## Example Use Cases

### SaaS Subscription Pricing

```yaml
company_name: "CloudSoft Inc"
industry: "SaaS"
pricing_model: "Subscription-based with usage tiers"

header_fields:
  - name: "contract_term"
    type: "select"
    options: ["Monthly", "Annual", "Multi-Year"]
    required: true
  
  - name: "mrr"
    type: "currency"
    calculated: true
    description: "Monthly Recurring Revenue"

line_item_fields:
  - name: "product_tier"
    type: "select"
    options: ["Starter", "Professional", "Enterprise"]
  
  - name: "user_count"
    type: "number"
    required: true
  
  - name: "per_user_price"
    type: "currency"
    calculated: true

price_calculation:
  step_1: "Determine per-user price based on tier"
  step_2: "Apply volume discount based on user count"
  step_3: "Apply annual contract discount if applicable"
  formula: "monthly_price = per_user_price * user_count * (1 - discount)"
```

### Manufacturing B2B Pricing

```yaml
company_name: "IndustrialCo"
industry: "Manufacturing"
pricing_model: "Tiered volume pricing with rebates"

line_item_fields:
  - name: "part_number"
    type: "string"
    required: true
  
  - name: "quantity"
    type: "number"
    required: true
  
  - name: "list_price"
    type: "currency"
  
  - name: "freight_cost"
    type: "currency"
    calculated: true
  
  - name: "tooling_charge"
    type: "currency"

volume_discounts:
  tiers:
    - quantity_from: 1
      quantity_to: 99
      discount: 0
    - quantity_from: 100
      quantity_to: 499
      discount: 10
    - quantity_from: 500
      quantity_to: null
      discount: 18

validation_rules:
  - rule: "Minimum order quantity"
    condition: "quantity >= 10"
    error_message: "Minimum order is 10 units"
    level: "error"
```

### Professional Services Pricing

```yaml
company_name: "ConsultPro"
industry: "Professional Services"
pricing_model: "Time & materials with fixed-price projects"

header_fields:
  - name: "engagement_type"
    type: "select"
    options: ["Fixed Price", "Time & Materials", "Retainer"]
  
  - name: "total_hours"
    type: "number"
    calculated: true

line_item_fields:
  - name: "resource_level"
    type: "select"
    options: ["Partner", "Senior Consultant", "Consultant", "Analyst"]
  
  - name: "hours"
    type: "number"
  
  - name: "hourly_rate"
    type: "currency"
  
  - name: "blended_rate"
    type: "currency"
    calculated: true

price_calculation:
  step_1: "Calculate line item total"
  formula_1: "line_total = hours * hourly_rate"
  
  step_2: "Apply volume discount for large engagements"
  condition: "IF total_hours > 500 THEN apply 10% discount"
  
  step_3: "Calculate weighted average blended rate"
  formula_3: "blended_rate = SUM(hours * hourly_rate) / total_hours"
```

## Setup Instructions

### 1. Configure OpenAI API Key

1. Go to **Admin** → **AI Pricing Engine**
2. Click the **Settings** tab
3. Get your API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
4. Paste the key and click **Save API Key**

### 2. Prepare Your Requirements

1. Download the template from the **Template** tab
2. Fill out each section with your specific pricing logic
3. Be as detailed as possible - more context helps the AI

### 3. Process with AI

1. Paste your completed template
2. Click **Process with AI**
3. Wait for the AI to analyze (typically 10-30 seconds)

### 4. Review Configuration

1. Review the **AI Analysis** explanation
2. Check **Header Fields** configuration
3. Check **Line Item Fields** configuration
4. Review **Calculation Rules**

### 5. Apply to System

1. Click **Apply Configuration to Quote System**
2. Your quote system is now configured!
3. Go to **Quotes** to start creating quotes with your new pricing logic

## Tips for Best Results

### Be Specific
❌ Bad: "Apply discounts based on quantity"
✅ Good: "Apply 5% discount for 10-50 units, 10% for 51-100 units, 15% for 100+ units"

### Provide Context
Include information about:
- Your industry and business model
- Common deal sizes and patterns
- Strategic pricing objectives
- Competitive positioning
- Margin requirements

### Define Formulas Clearly
❌ Bad: "Calculate the final price"
✅ Good: "final_price = (list_price - volume_discount) * quantity - rebate"

### Specify Edge Cases
- What happens with zero quantity?
- How to handle negative margins?
- Minimum/maximum price thresholds
- Required approvals for exceptions

### Use Consistent Naming
- Use underscores for field names: `customer_segment` not `CustomerSegment`
- Be consistent with terminology throughout
- Reference fields by their exact names in formulas

## Advanced Features

### Complex Conditional Logic

```yaml
price_calculation:
  step_1: "Determine base pricing"
  formula_1: "base_price = IF product_tier = 'Enterprise' THEN list_price * 0.85 ELSE list_price"
  
  step_2: "Apply conditional volume discount"
  formula_2: "volume_discount = CASE 
    WHEN quantity >= 1000 THEN 20
    WHEN quantity >= 500 AND customer_segment = 'Enterprise' THEN 15
    WHEN quantity >= 100 THEN 10
    ELSE 0"
```

### Lookup Tables

```yaml
pricing_tables:
  regional_multipliers:
    North America: 1.0
    Europe: 1.15
    Asia Pacific: 1.25
  
  currency_exchange:
    USD: 1.0
    EUR: 0.92
    GBP: 0.79

price_calculation:
  step_1: "Apply regional pricing"
  formula_1: "regional_price = base_price * regional_multipliers[region]"
```

### Multi-tier Discounting

```yaml
discount_logic:
  tier_1_volume_discount: "Based on quantity"
  tier_2_segment_discount: "Based on customer segment"
  tier_3_contract_discount: "Based on contract term"
  tier_4_payment_discount: "Based on payment terms"
  
  total_discount_cap: 30
  compounding: "multiplicative"  # or "additive"
  
  formula: "final_price = list_price * (1 - d1) * (1 - d2) * (1 - d3) * (1 - d4)"
```

## Troubleshooting

### AI Processing Fails

**Problem:** Error message when processing requirements

**Solutions:**
1. Check that your OpenAI API key is valid
2. Ensure you have API credits available
3. Check for YAML syntax errors in your template
4. Simplify complex sections and try again
5. Check browser console for detailed error messages

### Configuration Not Applied

**Problem:** Changes don't appear in quote system

**Solutions:**
1. Verify you clicked "Apply Configuration"
2. Refresh the quotes page
3. Check browser console for errors
4. Try creating a new quote

### Calculations Not Working

**Problem:** Auto-calculated fields showing incorrect values

**Solutions:**
1. Review the generated calculation rules
2. Check formula syntax in AI results
3. Ensure field names match exactly
4. Verify calculation dependencies are in correct order

### API Key Issues

**Problem:** "API key not configured" error

**Solutions:**
1. Go to Settings tab and save API key
2. Ensure key starts with "sk-"
3. Check key hasn't been revoked in OpenAI dashboard
4. Try copying key again (no extra spaces)

## Best Practices

### 1. Start Simple
Begin with basic pricing logic and add complexity incrementally

### 2. Test Thoroughly
Create test quotes with edge cases after applying configuration

### 3. Document Your Logic
Save your template files for future reference and modifications

### 4. Version Control
Keep different versions of your pricing templates as requirements evolve

### 5. Iterate
You can reprocess requirements and reapply configurations as needed

### 6. Review AI Output
Always review the AI-generated configuration before applying

### 7. Monitor Performance
Track how the pricing engine performs with real quotes

## Security & Privacy

- **API Keys** are stored securely in your Supabase backend
- **Templates** are processed via OpenAI API (review their data policy)
- **Calculations** run entirely on your infrastructure
- **No data** is stored by OpenAI after processing (per their API terms)

## Technical Architecture

```
User Template → Backend → OpenAI GPT-4o API
                    ↓
              AI Analysis
                    ↓
         Configuration JSON
                    ↓
         Supabase Storage
                    ↓
      Quote System (Live Calculations)
```

## Support & Resources

- **OpenAI API Documentation**: https://platform.openai.com/docs
- **YAML Syntax Guide**: https://yaml.org/spec/
- **Example Templates**: See built-in template in the UI

## Future Enhancements

Planned features:
- Support for multiple pricing strategies per organization
- A/B testing of different pricing configurations
- Historical pricing analysis and optimization
- Integration with external pricing services
- Machine learning for pricing recommendations
- Automated pricing optimization based on win rates

---

**Ready to get started?** Open the AI Pricing Engine and click on the Guide tab for an interactive walkthrough!
