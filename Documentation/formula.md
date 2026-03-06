# Sample AI Pricing Formulas

This document contains sample natural language formulas you can try testing out in the new **Admin > Formula Builder** UI. 

Since the AI uses the variables available in the quoting engine, you should reference standard line-item field names like `list_price`, `cost`, `discount_percent`, and `quantity` in your logic.

## 1. Simple Markup
Calculate a net price by marking up the cost by 25%.
- **Target Field**: `net_price`
- **Natural Language Logic**:
  > Multiply the cost by 1.25.

## 2. Standard Discount
Apply the discount percentage to the list price to find the final net price.
- **Target Field**: `net_price`
- **Natural Language Logic**:
  > Calculate the net price by multiplying the list price by 1 minus the discount percent.

## 3. Margin Calculation
Calculate the total profit margin for the line item.
- **Target Field**: `margin`
- **Natural Language Logic**:
  > Subtract the cost from the net price, and then multiply the result by the quantity.

## 4. Conditional/Complex Logic (Volume Tiering)
Calculates a customized target discount based on quantity thresholds.
- **Target Field**: `target_discount`
- **Natural Language Logic**:
  > If the quantity is greater than 100, return a 20% discount (0.20). If the quantity is greater than 50, return a 10% discount (0.10). Otherwise, return 0.

---

### How to test them:
1. Navigate to **Admin -> Formula Builder** on your live site.
2. Click **+ New Rule**.
3. Set the **Target Field** (e.g., `margin`).
4. Paste one of the Natural Language sentences above into the text area.
5. Click **✨ Generate with AI**.
6. The compiled Python/JS AST string (like `(net_price - cost) * quantity`) will appear below it.
7. Click **Test Run** to instantly perform the math against the sample product on the right!
