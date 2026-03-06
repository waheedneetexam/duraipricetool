import os
import re
import datetime

# Configuration
DOCS_DIR = 'Documentation'
LIBRARY_DIR = 'Library'
OUTPUT_FILE = 'readme.html'

HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Index - DuraiPricingTool</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 0; background: #f5f7fb; color: #111827; }}
    .wrap {{ max-width: 1200px; margin: 20px auto; padding: 0 16px; }}
    .card {{ background: #fff; border: 1px solid #d7dee7; border-radius: 10px; padding: 20px; }}
    h1 {{ margin-top: 0; }}
    .meta {{ color: #4b5563; margin-bottom: 12px; }}
    .controls {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 10px; }}
    .filter-group {{ display: flex; align-items: center; gap: 8px; }}
    select {{ padding: 8px 12px; border-radius: 6px; border: 1px solid #d7dee7; background: #fff; font-size: 14px; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ border: 1px solid #d7dee7; padding: 10px; text-align: left; vertical-align: top; }}
    th {{ background: #eef6ff; cursor: pointer; user-select: none; }}
    th:hover {{ background: #e0eeff; }}
    tr:nth-child(even) {{ background: #fafcff; }}
    tr.hidden {{ display: none; }}
    a {{ color: #0b63ce; text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    code {{ background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 1px 4px; font-size: 0.9em; }}
    .tag {{ display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; }}
    .tag-foundation {{ background: #dcfce7; color: #166534; }}
    .tag-specifications {{ background: #dbeafe; color: #1e40af; }}
    .tag-guides {{ background: #fef9c3; color: #854d0e; }}
    .tag-implementation {{ background: #f3e8ff; color: #6b21a8; }}
    .tag-maintenance {{ background: #fee2e2; color: #991b1b; }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>DuraiPricingTool Document Index</h1>
      <p class="meta">Auto-generated on {gen_date} UTC. Entries: {entry_count}</p>
      <div class="controls">
        <div class="filter-group">
          <label for="categoryFilter">Filter by Category:</label>
          <select id="categoryFilter">
            <option value="all">All Categories</option>
            <option value="Foundation">Foundation</option>
            <option value="Specifications">Specifications</option>
            <option value="Guides">Guides</option>
            <option value="Implementation">Implementation</option>
            <option value="Maintenance">Maintenance</option>
          </select>
        </div>
        <p class="meta" id="entryCount">Total visible: {entry_count}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th id="sort-title">Title ↕</th>
            <th id="sort-category">Category ↕</th>
            <th>Description</th>
            <th id="sort-type">Type ↕</th>
            <th id="sort-date">Created Date ▼</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody id="docsTableBody">
          {table_rows}
        </tbody>
      </table>
    </div>
  </div>
  <script>
    (function () {{
      const tbody = document.getElementById('docsTableBody');
      const categoryFilter = document.getElementById('categoryFilter');
      const entryCount = document.getElementById('entryCount');
      const headers = {{
        title: document.getElementById('sort-title'),
        category: document.getElementById('sort-category'),
        type: document.getElementById('sort-type'),
        date: document.getElementById('sort-date')
      }};
      let sortState = {{ key: 'date', desc: true }};
      function parseCreatedDate(text) {{
        const m = text.trim().match(/^(\\d{{4}})-(\\d{{2}})-(\\d{{2}})/);
        if (!m) return 0;
        return new Date(m[0]).getTime();
      }}
      function updateTable() {{
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const filter = categoryFilter.value;
        let visibleCount = 0;
        rows.forEach(row => {{
          const rowCat = row.getAttribute('data-category');
          if (filter === 'all' || rowCat === filter) {{
            row.classList.remove('hidden');
            visibleCount++;
          }} else {{
            row.classList.add('hidden');
          }}
        }});
        rows.sort((a, b) => {{
          let aVal, bVal;
          switch(sortState.key) {{
            case 'title':
              aVal = a.children[0].textContent.trim().toLowerCase();
              bVal = b.children[0].textContent.trim().toLowerCase();
              break;
            case 'category':
              aVal = a.children[1].textContent.trim().toLowerCase();
              bVal = b.children[1].textContent.trim().toLowerCase();
              break;
            case 'type':
              aVal = a.children[3].textContent.trim().toLowerCase();
              bVal = b.children[3].textContent.trim().toLowerCase();
              break;
            case 'date':
              aVal = parseCreatedDate(a.children[4].textContent);
              bVal = parseCreatedDate(b.children[4].textContent);
              break;
          }}
          if (aVal < bVal) return sortState.desc ? 1 : -1;
          if (aVal > bVal) return sortState.desc ? -1 : 1;
          return 0;
        }});
        const frag = document.createDocumentFragment();
        rows.forEach(r => frag.appendChild(r));
        tbody.appendChild(frag);
        Object.keys(headers).forEach(k => {{
          const base = headers[k].textContent.split(' ')[0];
          if (sortState.key === k) {{
            headers[k].textContent = base + (sortState.desc ? ' ▼' : ' ▲');
          }} else {{
            headers[k].textContent = base + ' ↕';
          }}
        }});
        entryCount.textContent = `Total visible: ${{visibleCount}}`;
      }}
      categoryFilter.addEventListener('change', updateTable);
      Object.keys(headers).forEach(k => {{
        headers[k].addEventListener('click', () => {{
          if (sortState.key === k) {{
            sortState.desc = !sortState.desc;
          }} else {{
            sortState.key = k;
            sortState.desc = false;
          }}
          updateTable();
        }});
      }});
      updateTable();
    }})();
  </script>
</body>
</html>
"""

def extract_md_metadata(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    metadata = {
        'title': os.path.basename(filepath),
        'category': 'Unknown',
        'description': '',
        'created': datetime.datetime.fromtimestamp(os.path.getctime(filepath)).strftime('%Y-%m-%d')
    }
    
    # Simple YAML frontmatter parser
    match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
    if match:
        yaml_content = match.group(1)
        for line in yaml_content.split('\n'):
            if ':' in line:
                key, val = line.split(':', 1)
                metadata[key.strip().lower()] = val.strip()
    
    return metadata

def extract_html_metadata(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE)
    title = title_match.group(1) if title_match else os.path.basename(filepath)
    
    # Use dirname as a proxy for category if not specified
    parent_dir = os.path.basename(os.path.dirname(filepath))
    category = "Implementation" # Default for Library files based on our analysis
    
    return {
        'title': title,
        'category': category,
        'description': 'HTML Documentation Report',
        'created': datetime.datetime.fromtimestamp(os.path.getctime(filepath)).strftime('%Y-%m-%d 00:00 UTC'),
        'type': 'HTML'
    }

def main():
    rows = []
    
    # Process Documentation directory
    for root, dirs, files in os.walk(DOCS_DIR):
        category = os.path.basename(root) if root != DOCS_DIR else "Foundation"
        for file in files:
            if file.endswith('.md'):
                path = os.path.join(root, file)
                meta = extract_md_metadata(path)
                # Override category with sub-dir if not specified in frontmatter
                if meta['category'] == 'Unknown':
                    meta['category'] = category
                
                rows.append(f"""
          <tr data-category="{meta['category']}">
            <td>{meta['title']}</td>
            <td><span class="tag tag-{meta['category'].lower()}">{meta['category']}</span></td>
            <td>{meta['description']}</td>
            <td>Markdown</td>
            <td>{meta['created']}</td>
            <td><a href="/{path}" target="_blank">Open</a></td>
          </tr>""")

    # Process Library directory
    if os.path.exists(LIBRARY_DIR):
        for file in os.listdir(LIBRARY_DIR):
            if file.endswith('.html'):
                path = os.path.join(LIBRARY_DIR, file)
                meta = extract_html_metadata(path)
                rows.append(f"""
          <tr data-category="{meta['category']}">
            <td>{meta['title']}</td>
            <td><span class="tag tag-{meta['category'].lower()}">{meta['category']}</span></td>
            <td>{meta['description']}</td>
            <td>HTML</td>
            <td>{meta['created']}</td>
            <td><a href="/{path}" target="_blank">Open</a></td>
          </tr>""")

    # Other known doc locations
    extra_docs = [
        ('frontend/public/business-prompt.html', 'Foundation', 'Business + UI Prompt Blueprint', 'HTML'),
        ('frontend/public/prompt.html', 'Foundation', 'Setup & Deploy Prompt', 'HTML'),
        ('frontend/public/system-control.html', 'Maintenance', 'System Control Commands', 'HTML'),
    ]
    for path, cat, desc, dtype in extra_docs:
        if os.path.exists(path):
            rows.append(f"""
          <tr data-category="{cat}">
            <td>{os.path.basename(path)}</td>
            <td><span class="tag tag-{cat.lower()}">{cat}</span></td>
            <td>{desc}</td>
            <td>{dtype}</td>
            <td>{datetime.datetime.fromtimestamp(os.path.getctime(path)).strftime('%Y-%m-%d')}</td>
            <td><a href="/{path}" target="_blank">Open</a></td>
          </tr>""")

    gen_date = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M')
    final_html = HTML_TEMPLATE.format(
        gen_date=gen_date,
        entry_count=len(rows),
        table_rows="\n".join(rows)
    )
    
    with open(OUTPUT_FILE, 'w') as f:
        f.write(final_html)
    
    print(f"Index updated: {OUTPUT_FILE} ({len(rows)} entries)")

if __name__ == "__main__":
    main()
