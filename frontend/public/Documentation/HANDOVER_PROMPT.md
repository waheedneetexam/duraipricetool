# Handover Prompt for AI Formula Builder Handoff

### **Context & Objective**
The objective is to fix a data-loading bug in the **Formula Builder Admin** component of the `DuraiPriceTool`. While AI formula generation and saving to the database are working perfectly, the frontend fails to correctly display the saved logic when a rule is selected from the sidebar.

### **1. Technical Architecture (NL to Formula)**
The system translates English descriptions into mathematical formulas using a 4-step flow:
1.  **Frontend**: The user enters logic in `FormulaBuilderAdmin.tsx`.
2.  **API**: Calls `/admin/field-logic/validate`.
3.  **AI Service**: `ai_service.py` uses OpenAI (GPT-4o) to turn text into a Python/JS compatible math string (e.g., `cost * 1.25`).
4.  **Database**: The rule is saved to **PostgreSQL** in the table `field_logic_rules`.

### **2. Technical Stack & Remote Server Details**
*   **Operating System**: Oracle Linux (Remote)
*   **Backend**: FastAPI (Python 3.12)
*   **Frontend**: React + TypeScript (Vite)
*   **Database**: PostgreSQL (System of Record)
*   **Remote IP**: `129.151.152.207`
*   **SSH Access**: `ssh -i /home/waheed/Work/Anti-Gravity/PhotonNetwork/Server/Oracle/ssh-key-2026-01-09.key waheed@129.151.152.207`
*   **Postgres DSN**: `postgresql://postgres:postgres@127.0.0.1:5432/duraipricing`

### **3. Relevant Files**
1.  **Backend Services**: `/home/waheed/DuraiPricingTool/app/services/admin_config_service.py` (Handles DB Save/List logic).
2.  **Frontend UI**: `/home/waheed/DuraiPricingTool/frontend/src/components/FormulaBuilderAdmin.tsx` (Manages state and rule selection).
3.  **API Routes**: `/home/waheed/DuraiPricingTool/app/api/routes_admin.py`.

### **4. The Core Issue (To be Fixed)**
*   **Symptom**: When a user selects "net_price" or any saved rule from the sidebar, the "Logic Workspace" (Central Panel) often remains at a default state or fails to populate the `logic_text` and `generated_code` associated with that specific rule.
*   **Likely Cause**: There is a mismatch or race condition between how the rule IDs (`logic_id` vs `id`) are handled during the `loadRules()` state update and how the `activeRule` is derived via `setActiveRuleId`.
*   **Requirement**: Ensure that when a rule is clicked in the sidebar, its `natural_language_logic` and `generated_code` are immediately and accurately loaded into the editor and the simulator.

***

**Suggested First Step for Agent:**
"Check the `mapped` data in the `loadRules()` function in `FormulaBuilderAdmin.tsx` and verify that the `activeRule` state is correctly reconciling with the rule list after a database reload."
