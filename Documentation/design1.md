## Project: Enterprise Data Management UI
Framework: React/Tailwind CSS (or your preferred stack)
Icon Library: Lucide-React or Phosphor Icons
Font: Inter or San Francisco (System UI)

### 1. Layout Architecture
Sidebar (Width: 280px): Fixed left navigation. Use a light gray background (#F9FAFB) with a 1px border. Items should be rounded cards with a vertical list of icons and labels (e.g., "Product Hierarchies", "Table Organization").

Top Bar (Height: 64px): Dark theme (#1A1B2E). Center-aligned search bar with a glassmorphism effect. Right-aligned "Quick Actions" dropdown and "User Profile" pill.

Main Stage: A centered container (max-width: 1400px) with a subtle background (#F3F4F6).

### 2. Component Specifications
Header Section:

Implement a breadcrumb component: Home / Data Management / Product Hierarchies.

H1 Title: Table: Product Hierarchies.

Action Group: A primary Blue button (#007BFF) for "Save" and a ghost/outline button for "View Data".

Step 1: Classification Card:

Horizontal Flexbox layout.

Custom Select/Dropdown for "Schema".

Tag/Chip Group for "Classification Tags" with "X" delete icons.

Muted timestamp text on the far right.

Step 2: Upload Zone (Primary Action):

A large div with border-dashed border-2 border-slate-300.

Hover state: Change border color to Blue and add a light blue background tint.

Center-aligned icon and bold instruction text.

Step 3: Validation & Mapping Grid:

A 2-column grid (grid-cols-2) inside a white card.

Left Column (Rules): A mini-table showing rule ID and description. Include "Edit" and "Trash" icons in the rightmost cell.

Right Column (Mapping): A table showing "Source Column" mapped to "System Field".

Footer: A sticky button bar at the bottom of the card with justify-start alignment.

### 3. Design Tokens & Styling
Border Radius: 12px (rounded-xl) for all main cards.

Shadows: box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1).

Colors:

Primary: Teal/Blue (#0E7490) for action buttons.

Neutral: Slate-500 for secondary text.

Success: Emerald-600 for validated states.

### 4. Functional Logic to Implement
Accordion Toggle: The "Validation Rules" and "Mapping" sections should be collapsible.

File State: When a file is "uploaded" (mock state), hide the Drag & Drop text and show a "File Uploaded: data.csv" success message.

Active State: The sidebar item matching the current page should have a distinct "active" background color.