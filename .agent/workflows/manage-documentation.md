---
description: Documentation Management Workflow
---
// turbo-all

Follow these steps whenever creating, moving, or updating documentation in this project:

1. **Check Standards**: Read [STANDARDS.md](file:///home/waheed/Work/Anti-Gravity/DuraiPriceTool/Documentation/STANDARDS.md) to identify the correct category and directory.
2. **Metadata**: Ensure the `.md` file has the required YAML frontmatter (title, category, description, created).
3. **Placement**: Move/Save the file into the correct subdirectory of `Documentation/`.
4. **Update Index**: Run the auto-indexing script to update the `readme.html` file:
   ```bash
   python scripts/generate_doc_index.py
   ```
5. **Verify**: Open `readme.html` and confirm the new entry appears with the correct metadata and category filter works.
