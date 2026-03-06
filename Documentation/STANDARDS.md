---
title: DuraiPricingTool README
category: Foundation
description: Modular enterprise pricing foundation overview and architecture.
created: 2026-02-28
---

# Documentation Standards

This document defines the requirements for all documentation files in this project to ensure consistency and automatic indexing.

## 1. Directory Structure
All documents must be placed in the appropriate subdirectory of `Documentation/` or `Library/`:

- `Documentation/Foundation`: Core architecture, blueprints, and high-level policies.
- `Documentation/Specifications`: Detailed technical requirements for specific features.
- `Documentation/Guides`: End-user manuals, logic guides, and how-to documents.
- `Documentation/Implementation`: Implementation plans, completion reports, and status updates.
- `Documentation/Maintenance`: System management commands, error logs, and validation reports.
- `Library/`: Standalone HTML documentation and reports.

## 2. Metadata Frontmatter
Every `.md` file MUST start with a YAML-style frontmatter block to support automatic indexing in `readme.html`.

```markdown
---
title: [Short Descriptive Title]
category: [Foundation | Specifications | Guides | Implementation | Maintenance]
description: [1-2 sentence summary of the document]
created: [YYYY-MM-DD]
---
```

## 3. Index Management
The `readme.html` file at the project root is the source of truth for all documentation. 
- **Auto-Update**: After creating or moving a document, run the indexing script:
  ```bash
  python scripts/generate_doc_index.py
  ```
- **Manual Edits**: Avoid manually editing the table in `readme.html`. Update the file's frontmatter and run the script instead.
