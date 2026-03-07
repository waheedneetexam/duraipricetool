## Technical UI Specification: "Data Management Table View"
Layout & Theme:

Overall Theme: Modern Enterprise SaaS. Neutral light-gray background (#F3F4F6) with high-contrast white cards.

Sidebar: Fixed width (280px). Soft-white background with a subtle right border. Use "Card-style" menu items with rounded corners and distinct icons for each data type.

Top Navigation: Dark Navy/Indigo header (#1A1B2E). Contains a centered global search bar, a "Quick Actions" dropdown, and a user profile section with a pill-shaped button.

Main Content Area: Max-width 1400px, centered with generous padding.

Section 1: Header & Breadcrumbs

Breadcrumbs: Small, clickable path above the title: Home / Data Management / Product Hierarchies.

Title: H1, Bold, Table: Product Hierarchies.

Actions: "Save" (Primary Blue) and "View Data" (Secondary White) buttons grouped top-right.

Section 2: Interactive Cards (The "Step" System)
Divide the workflow into three distinct, vertically stacked white cards with border-radius: 12px and box-shadow: subtle.

Card 1: Database Classification

Horizontal layout.

Left: "Schema" dropdown.

Center: "Classification Tags" using a "Pill/Chip" UI with 'X' remove icons.

Right: "Last Update" timestamp in small, muted text.

Card 2: Primary File Upload (Focal Point)

Large dashed-border drop zone (border-style: dashed, border-color: #64748B).

Centered: Large "Document/Database" icon, bold text "Drag & Drop or Click to Upload Data File", and a small "Limit: 100MB" helper text.

Card 3: Validation & Mapping (Integrated Details)

Header: A "Step-Progress" indicator showing Validate -> Map Columns -> Import with arrow icons.

Body: A split-screen layout (50/50).

Left (Validation Rules): An accordion or table listing rules with "Edit" and "Delete" icons.

Right (Mapping): A table showing source vs. destination column names.

Footer: Sticky action bar inside the card with "Validate and Prepare Import" (Primary Teal) and "Clear Form" (Text Link/Ghost button).

## Implementation Checklist for the Agent
[ ] Use Tailwind CSS for layout and spacing.

[ ] Use Lucide-React or Phosphor Icons for the UI icons.

[ ] Ensure the Sidebar is responsive (collapsible on smaller screens).

[ ] Implement Radix UI or Headless UI for the dropdowns and accordions.