import json
import re
from difflib import get_close_matches
from datetime import datetime, timezone
from uuid import uuid4

from app.db.postgres_client import pg_client

DEFAULT_TENANT_ID = "default"




def _normalize_tenant_id(tenant_id: str | None) -> str:
    raw = (tenant_id or "").strip()
    return raw or DEFAULT_TENANT_ID


def _ensure_postgres_tables() -> None:
    pg_client.execute(
        """
        CREATE TABLE IF NOT EXISTS field_logic_rules (
            logic_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            scope TEXT NOT NULL,
            field_key TEXT NOT NULL,
            natural_language_logic TEXT,
            generated_code TEXT,
            explanation TEXT,
            dependencies_json JSONB,
            version INTEGER DEFAULT 1,
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    pg_client.execute(
        """
        CREATE TABLE IF NOT EXISTS field_logic_validation_runs (
            validation_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            scope TEXT NOT NULL,
            field_key TEXT NOT NULL,
            status TEXT NOT NULL,
            severity TEXT NOT NULL,
            errors_json JSONB,
            warnings_json JSONB,
            generated_code TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    pg_client.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_pricing_configurations (
            config_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            template_text TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            summary TEXT,
            confidence DOUBLE PRECISION,
            processed_result_json JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )




def _ensure_tables() -> None:
    _ensure_postgres_tables()


def _get_table_columns() -> dict[str, set[str]]:
    columns: dict[str, set[str]] = {}

    def add_rows(rows: list[dict[str, object]]):
        for row in rows:
            table_name = str(row.get("table_name") or "").strip()
            column_name = str(row.get("column_name") or "").strip()
            if not table_name or not column_name:
                continue
            columns.setdefault(table_name, set()).add(column_name)

    # Authoritative schema from Postgres.
    try:
        pg_rows = pg_client.execute(
            """
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            """
        )
        add_rows(pg_rows)
    except Exception:
        pass

    return columns


def get_public_schema_columns() -> dict[str, list[str]]:
    table_columns = _get_table_columns()
    return {table: sorted(cols) for table, cols in sorted(table_columns.items())}


def build_sql_draft(tenant_id: str | None, scope: str, field_key: str, logic_text: str) -> dict:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)
    table_columns = _get_table_columns()
    available_schema = {table: sorted(cols) for table, cols in table_columns.items()}
    known_column_names = sorted({column for cols in table_columns.values() for column in cols})
    join_hints = _infer_join_hints(table_columns)

    dependencies, warnings, missing_tables = _build_schema_hints(logic_text, table_columns)
    for table_name in missing_tables:
        suggestions = _suggest_similar_tables(table_name, set(table_columns.keys()))
        warnings.append(
            {
                "type": "missing_table",
                "message": f'Table "{table_name}" does not exist',
                "suggestion": f'Create or import "{table_name}" from Admin data management'
                + (f'. Did you mean: {", ".join(suggestions)}?' if suggestions else ""),
            }
        )

    from app.services.ai_service import generate_sql_draft

    ai_res = generate_sql_draft(
        scope,
        field_key,
        logic_text,
        available_schema,
        known_column_names,
        join_hints,
        tenant_id=tenant,
    )

    # Merge AI dependencies into detected dependencies for display.
    for col in ai_res.get("columns", []):
        if col not in dependencies["columns"]:
            dependencies["columns"].append(col)
    for table in ai_res.get("tables", []):
        if table not in dependencies["tables"]:
            dependencies["tables"].append(table)

    missing_columns = ai_res.get("missing_columns", []) or []
    # If AI returns qualified columns, validate and drop false positives.
    if missing_columns:
        filtered_missing: list[str] = []
        for item in missing_columns:
            cleaned = (item or "").strip()
            if not cleaned:
                continue

            table_name = None
            column_name = None
            match = re.match(r"([A-Za-z_][A-Za-z0-9_]*)\\s+in\\s+([A-Za-z_][A-Za-z0-9_]*)", cleaned)
            if match:
                column_name = match.group(1)
                table_name = match.group(2)
            elif "." in cleaned:
                table_name, column_name = cleaned.split(".", 1)
            else:
                column_name = cleaned

            if table_name and column_name and table_name in table_columns and column_name in table_columns[table_name]:
                if column_name not in dependencies["columns"]:
                    dependencies["columns"].append(column_name)
                if table_name not in dependencies["tables"]:
                    dependencies["tables"].append(table_name)
                continue

            if column_name and column_name in {c for cols in table_columns.values() for c in cols}:
                tables_with = [t for t, cols in table_columns.items() if column_name in cols]
                warnings.append(
                    {
                        "type": "column_location",
                        "message": f'Column "{column_name}" exists but not in the specified table.',
                        "suggestion": f'Found in: {", ".join(sorted(tables_with))}.',
                    }
                )
                continue

            filtered_missing.append(cleaned)
        missing_columns = filtered_missing

    sql_text = ai_res.get("sql", "") or ""
    formula_text = ai_res.get("formula", "") or ""
    if not formula_text and sql_text:
        formula_text = _extract_formula_from_sql(sql_text, field_key, table_columns)
    formula_text = _strip_formula_prefixes(formula_text, sql_text, table_columns)
    pseudo_code = _sql_to_pseudocode(sql_text, field_key, table_columns)

    return {
        "sql": sql_text,
        "formula": formula_text,
        "pseudo_code": pseudo_code,
        "tables": ai_res.get("tables", []),
        "columns": ai_res.get("columns", []),
        "missing_columns": missing_columns,
        "notes": ai_res.get("notes", ""),
        "warnings": warnings,
        "dependencies": dependencies,
        "schema": available_schema,
    }


def build_sql_draft_vanna(tenant_id: str | None, scope: str, field_key: str, logic_text: str) -> dict:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)
    table_columns = _get_table_columns()
    available_schema = {table: sorted(cols) for table, cols in table_columns.items()}
    known_column_names = sorted({column for cols in table_columns.values() for column in cols})
    join_hints = _infer_join_hints(table_columns)

    dependencies, warnings, missing_tables = _build_schema_hints(logic_text, table_columns)
    for table_name in missing_tables:
        suggestions = _suggest_similar_tables(table_name, set(table_columns.keys()))
        warnings.append(
            {
                "type": "missing_table",
                "message": f'Table "{table_name}" does not exist',
                "suggestion": f'Create or import "{table_name}" from Admin data management'
                + (f'. Did you mean: {", ".join(suggestions)}?' if suggestions else ""),
            }
        )

    from app.services.vanna_service import generate_sql_with_vanna

    hint_block = "\n".join(join_hints)
    question = f"{logic_text}\nReturn a SQL query that includes a computed column named {field_key} for the final result."
    if hint_block:
        question = f"{question}\nJoin hints:\n{hint_block}"
    sql = generate_sql_with_vanna(question, tenant_id=tenant)

    def extract_tables(sql_text: str) -> list[str]:
        tables: set[str] = set()
        for match in re.finditer(r"\bfrom\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+\w+)?", sql_text, flags=re.IGNORECASE):
            tables.add(match.group(1))
        for match in re.finditer(r"\bjoin\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+\w+)?", sql_text, flags=re.IGNORECASE):
            tables.add(match.group(1))
        return sorted(tables)

    def extract_columns(sql_text: str) -> list[str]:
        columns: set[str] = set()
        for match in re.finditer(r"\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\b", sql_text):
            table_name = match.group(1)
            column_name = match.group(2)
            if table_name in table_columns and column_name in table_columns[table_name]:
                columns.add(column_name)
        for col in known_column_names:
            if re.search(rf"\b{re.escape(col)}\b", sql_text):
                columns.add(col)
        return sorted(columns)

    def extract_formula(sql_text: str) -> str:
        if not sql_text:
            return ""
        select_match = re.search(r"\bselect\b(.*?)\bfrom\b", sql_text, flags=re.IGNORECASE | re.DOTALL)
        if not select_match:
            return ""
        select_body = select_match.group(1)
        parts: list[str] = []
        buf = []
        depth = 0
        for ch in select_body:
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth = max(depth - 1, 0)
            if ch == ',' and depth == 0:
                parts.append(''.join(buf))
                buf = []
                continue
            buf.append(ch)
        if buf:
            parts.append(''.join(buf))

        target = field_key.lower()
        for part in parts:
            alias_match = re.search(r"\bas\s+([A-Za-z_][A-Za-z0-9_]*)\b", part, flags=re.IGNORECASE)
            if alias_match and alias_match.group(1).lower() == target:
                expr = part[:alias_match.start()].strip()
                for table in table_columns.keys():
                    expr = re.sub(rf"\b{re.escape(table)}\.", "", expr)
                return expr
        return ""

    tables = extract_tables(sql)
    columns = extract_columns(sql)
    formula = extract_formula(sql)
    if not formula and sql:
        formula = _extract_formula_from_sql(sql, field_key, table_columns)
    formula = _strip_formula_prefixes(formula, sql, table_columns)
    pseudo_code = _sql_to_pseudocode(sql, field_key, table_columns)

    return {
        "sql": sql,
        "formula": formula,
        "pseudo_code": pseudo_code,
        "tables": tables,
        "columns": columns,
        "missing_columns": [],
        "notes": "Generated via Vanna",
        "warnings": warnings,
        "dependencies": dependencies,
        "schema": available_schema,
    }



_PARSER_STOP_WORDS = {"the", "a", "an", "some", "every", "all", "its", "their", "of", "to", "in", "on", "at", "by", "with"}
_SQL_KEYWORDS = {
    "on",
    "where",
    "join",
    "left",
    "right",
    "inner",
    "full",
    "cross",
    "group",
    "order",
    "limit",
    "offset",
    "union",
    "having",
    "as",
}


def _normalize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def _extract_table_aliases(sql_text: str) -> set[str]:
    aliases: set[str] = set()
    if not sql_text:
        return aliases
    pattern = r"\b(?:from|join)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+as)?\s+([A-Za-z_][A-Za-z0-9_]*)"
    for match in re.finditer(pattern, sql_text, flags=re.IGNORECASE):
        table_name = match.group(1)
        alias = match.group(2)
        if not alias:
            continue
        if alias.lower() in _SQL_KEYWORDS:
            continue
        if alias.lower() == table_name.lower():
            continue
        aliases.add(alias)
    return aliases


def _strip_formula_prefixes(formula: str, sql_text: str, table_columns: dict[str, set[str]]) -> str:
    if not formula:
        return formula
    prefixes = set(table_columns.keys())
    prefixes.update(_extract_table_aliases(sql_text))
    for prefix in sorted(prefixes, key=len, reverse=True):
        formula = re.sub(rf"\b{re.escape(prefix)}\.", "", formula)
    return formula


def _extract_formula_from_sql(sql_text: str, field_key: str, table_columns: dict[str, set[str]]) -> str:
    if not sql_text:
        return ""
    select_match = re.search(r"\bselect\b(.*?)\bfrom\b", sql_text, flags=re.IGNORECASE | re.DOTALL)
    if not select_match:
        return ""
    select_body = select_match.group(1)
    parts: list[str] = []
    buf = []
    depth = 0
    for ch in select_body:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth = max(depth - 1, 0)
        if ch == ',' and depth == 0:
            parts.append(''.join(buf))
            buf = []
            continue
        buf.append(ch)
    if buf:
        parts.append(''.join(buf))

    target = (field_key or "").lower()
    for part in parts:
        alias_match = re.search(r"\bas\s+([A-Za-z_][A-Za-z0-9_]*)\b", part, flags=re.IGNORECASE)
        if alias_match and alias_match.group(1).lower() == target:
            expr = part[:alias_match.start()].strip()
            return _strip_formula_prefixes(expr, sql_text, table_columns)
    return ""


def _sql_to_pseudocode(sql_text: str, field_key: str, table_columns: dict[str, set[str]]) -> str:
    if not sql_text:
        return ""
    steps: list[str] = []
    from_match = re.search(r"\bfrom\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+([A-Za-z_][A-Za-z0-9_]*))?", sql_text, flags=re.IGNORECASE)
    if from_match:
        table_name = from_match.group(1)
        alias = from_match.group(2)
        if alias and alias.lower() not in _SQL_KEYWORDS and alias.lower() != table_name.lower():
            steps.append(f"FROM {table_name} AS {alias}")
        else:
            steps.append(f"FROM {table_name}")

    join_pattern = r"\bjoin\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+([A-Za-z_][A-Za-z0-9_]*))?\s+on\s+([^;\\n\\r]+)"
    for match in re.finditer(join_pattern, sql_text, flags=re.IGNORECASE):
        table_name = match.group(1)
        alias = match.group(2)
        condition = match.group(3).strip()
        if alias and alias.lower() not in _SQL_KEYWORDS and alias.lower() != table_name.lower():
            steps.append(f"JOIN {table_name} AS {alias} ON {condition}")
        else:
            steps.append(f"JOIN {table_name} ON {condition}")

    formula = _extract_formula_from_sql(sql_text, field_key, table_columns)
    formula = _strip_formula_prefixes(formula, sql_text, table_columns)
    if formula:
        steps.append(f"SET {field_key} = {formula}")
    return "\n".join(steps)


def _tokenize_phrase(value: str) -> list[str]:
    raw = re.split(r"[^A-Za-z0-9]+", (value or "").lower())
    return [t for t in raw if t and t not in _PARSER_STOP_WORDS]


def _column_tokens(column_name: str) -> set[str]:
    parts = re.split(r"[_\\W]+", column_name or "")
    tokens = []
    for part in parts:
        if not part:
            continue
        # split camelCase into words
        tokens.extend(re.findall(r"[A-Z]?[a-z]+|[0-9]+|[A-Z]+(?![a-z])", part))
    return {t.lower() for t in tokens if t}


def _suggest_similar_columns(logic_text: str, column_names: set[str]) -> list[str]:
    if not logic_text or not column_names:
        return []
    logic_tokens = set(_tokenize_phrase(logic_text))
    if not logic_tokens:
        return []

    scored: list[tuple[int, str]] = []
    for col in column_names:
        col_tokens = _column_tokens(col)
        if not col_tokens:
            continue
        score = len(col_tokens & logic_tokens)
        if score > 0:
            scored.append((score, col))

    if not scored:
        # fallback to fuzzy matching with normalized text
        normalized = _normalize_token(logic_text)
        if not normalized:
            return []
        norm_map = {col: _normalize_token(col) for col in column_names}
        matches = get_close_matches(normalized, list(norm_map.values()), n=5, cutoff=0.6)
        reverse = {v: k for k, v in norm_map.items()}
        return [reverse[m] for m in matches if m in reverse]

    scored.sort(key=lambda x: (-x[0], x[1]))
    return [col for _, col in scored[:5]]


def _suggest_similar_tables(table_name: str, table_names: set[str]) -> list[str]:
    if not table_name or not table_names:
        return []
    matches = get_close_matches(table_name, sorted(table_names), n=3, cutoff=0.6)
    return matches


def _infer_join_hints(table_columns: dict[str, set[str]]) -> list[str]:
    hints: list[str] = []
    table_names = sorted(table_columns.keys())

    def score_candidate(base: str, table_name: str) -> int:
        t = table_name.lower()
        if t == base or t == f"{base}s":
            return 3
        if base in t:
            return 1
        return 0

    for table, cols in table_columns.items():
        for col in cols:
            if not col.endswith("_id"):
                continue
            base = col[:-3]
            candidates = [t for t in table_names if t != table and col in table_columns[t]]
            if not candidates:
                continue
            candidates.sort(key=lambda t: (-score_candidate(base, t), t))
            for other in candidates[:2]:
                hint = f"{table}.{col} -> {other}.{col}"
                if hint not in hints:
                    hints.append(hint)
    return hints


def _build_schema_hints(logic_text: str, table_columns: dict[str, set[str]]) -> tuple[dict[str, list[str]], list[dict[str, str]], list[str]]:
    dependencies: dict[str, list[str]] = {"tables": [], "columns": []}
    warnings: list[dict[str, str]] = []
    missing_tables: list[str] = []

    logic = (logic_text or "").strip()
    known_table_names = set(table_columns.keys())
    known_column_names = {column for cols in table_columns.values() for column in cols}

    tables = _extract_tables(logic)
    for table_name in table_columns.keys():
        if re.search(rf"\\b{re.escape(table_name)}\\b", logic, flags=re.IGNORECASE):
            tables.add(table_name)

    for table_name in sorted(tables):
        if table_name not in table_columns:
            missing_tables.append(table_name)
        else:
            dependencies["tables"].append(table_name)

    def handle_qualified_token(token: str) -> None:
        if not token or "." not in token:
            return
        table_name, column_name = token.split(".", 1)
        if table_name in table_columns and column_name in table_columns[table_name]:
            if table_name not in dependencies["tables"]:
                dependencies["tables"].append(table_name)
            if column_name not in dependencies["columns"]:
                dependencies["columns"].append(column_name)
            return
        if table_name not in table_columns:
            missing_tables.append(table_name)
            return
        suggestions = get_close_matches(column_name, sorted(table_columns.get(table_name, set())), n=3, cutoff=0.7)
        warnings.append(
            {
                "type": "unknown_token",
                "message": f'"{token}" not recognized as a current table/column',
                "suggestion": "Verify spelling or add the required table column"
                + (f'. Did you mean: {", ".join(suggestions)}?' if suggestions else ""),
            }
        )

    # Detect qualified tokens in plain text (table.column)
    for match in re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\b", logic):
        handle_qualified_token(f"{match[0]}.{match[1]}")

    quoted_tokens = _extract_quoted_columns(logic)
    for token in quoted_tokens:
        if "." in token:
            handle_qualified_token(token)
    unknown_quoted = sorted(
        token
        for token in quoted_tokens
        if token not in tables and token not in known_column_names and "." not in token
    )
    for token in unknown_quoted:
        suggestions = get_close_matches(token, sorted(known_column_names), n=3, cutoff=0.7)
        warnings.append(
            {
                "type": "unknown_token",
                "message": f'"{token}" not recognized as a current table/column',
                "suggestion": "Verify spelling or add the required table column"
                + (f'. Did you mean: {", ".join(suggestions)}?' if suggestions else ""),
            }
        )

    for token in sorted(token for token in quoted_tokens if token in known_column_names):
        dependencies["columns"].append(token)

    suggested_columns = _suggest_similar_columns(logic, known_column_names)
    if suggested_columns and not dependencies["columns"]:
        warnings.append(
            {
                "type": "suggested_columns",
                "message": "Consider these columns based on your description.",
                "suggestion": ", ".join(suggested_columns),
            }
        )

    return dependencies, warnings, missing_tables


def _extract_tables(logic_text: str) -> set[str]:
    tables: set[str] = set()
    for match in re.findall(r'"([A-Za-z_][A-Za-z0-9_]*)"\s+table', logic_text):
        tables.add(match)
    for match in re.findall(r"\bfrom\s+([A-Za-z_][A-Za-z0-9_]*)\b", logic_text, flags=re.IGNORECASE):
        if match.lower() not in _PARSER_STOP_WORDS:
            tables.add(match)
    return tables


def _extract_quoted_columns(logic_text: str) -> set[str]:
    return set(re.findall(r'"([A-Za-z_][A-Za-z0-9_]*)"', logic_text))


def validate_field_logic(tenant_id: str | None, scope: str, field_key: str, logic_text: str) -> dict:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)
    normalized_scope = (scope or "line_item").strip() or "line_item"
    normalized_field = (field_key or "").strip()
    logic = (logic_text or "").strip()

    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    dependencies: dict[str, list[str]] = {"tables": [], "columns": []}

    if not normalized_field:
        errors.append({"type": "missing_field", "message": "Field key is required"})
    if not logic:
        errors.append({"type": "empty_logic", "message": "Logic text cannot be empty"})

    table_columns = _get_table_columns()
    known_column_names = {column for cols in table_columns.values() for column in cols}

    dependencies, warning_hints, missing_tables = _build_schema_hints(logic, table_columns)
    warnings.extend(warning_hints)
    for table_name in missing_tables:
        suggestions = _suggest_similar_tables(table_name, set(table_columns.keys()))
        errors.append(
            {
                "type": "missing_table",
                "message": f'Table "{table_name}" does not exist',
                "suggestion": f'Create or import "{table_name}" from Admin data management'
                + (f'. Did you mean: {", ".join(suggestions)}?' if suggestions else ""),
            }
        )

    from app.services.ai_service import generate_field_logic
    
    try:
        if not errors:
            suggested_columns = _suggest_similar_columns(logic, known_column_names)
            if suggested_columns and not dependencies["columns"]:
                warnings.append(
                    {
                        "type": "suggested_columns",
                        "message": "Consider these columns based on your description.",
                        "suggestion": ", ".join(suggested_columns),
                    }
                )
            ai_res = generate_field_logic(
                normalized_scope,
                normalized_field,
                logic,
                list(known_column_names),
                {table: sorted(cols) for table, cols in table_columns.items()},
                tenant_id=tenant,
            )
            generated_code = ai_res["generated_code"]
            for col in ai_res["dependencies"].get("columns", []):
                if col not in dependencies["columns"]:
                    dependencies["columns"].append(col)
        else:
            generated_code = ""
    except Exception as e:
        warnings.append({"type": "ai_generation_error", "message": str(e), "suggestion": "Check AI Provider API keys or prompt"})
        generated_code = ""

    if not errors and not generated_code:
        errors.append({"type": "ai_empty_response", "message": "AI failed to generate a formula. Please try rephrasing your logic description."})

    status = "valid" if not errors else "invalid"
    severity = "error" if errors else ("warning" if warnings else "info")
    validation_id = str(uuid4())

    pg_client.execute(
        """
        INSERT INTO field_logic_validation_runs (
            validation_id, tenant_id, scope, field_key, status, severity,
            errors_json, warnings_json, generated_code, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, CURRENT_TIMESTAMP)
        """,
        (
            validation_id,
            tenant,
            normalized_scope,
            normalized_field,
            status,
            severity,
            json.dumps(errors),
            json.dumps(warnings),
            generated_code,
        ),
    )

    return {
        "validationId": validation_id,
        "status": status,
        "severity": severity,
        "errors": errors,
        "warnings": warnings,
        "dependencies": dependencies,
        "generated_code": generated_code,
    }


def save_field_logic_rule(
    tenant_id: str | None,
    scope: str,
    field_key: str,
    logic_text: str,
    generated_code: str,
    explanation: str,
    dependencies: dict | None = None,
) -> dict:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)
    normalized_scope = (scope or "line_item").strip() or "line_item"
    normalized_field = (field_key or "").strip()
    logic = (logic_text or "").strip()
    code = (generated_code or "").strip()
    note = (explanation or "").strip()
    dep = dependencies or {}

    if not normalized_field:
        raise ValueError("field_key is required")
    if not logic:
        raise ValueError("logic_text is required")

    if _tx_on_postgres():
        version_rows = pg_client.execute(
            """
            SELECT COALESCE(MAX(version), 0) AS max_version
            FROM field_logic_rules
            WHERE tenant_id = %s AND scope = %s AND field_key = %s
            """,
            (tenant, normalized_scope, normalized_field),
        )
        next_version = int(version_rows[0]["max_version"] or 0) + 1
        pg_client.execute(
            """
            UPDATE field_logic_rules
            SET active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE tenant_id = %s AND scope = %s AND field_key = %s
            """,
            (tenant, normalized_scope, normalized_field),
        )
        logic_id = str(uuid4())
        pg_client.execute(
            """
            INSERT INTO field_logic_rules (
                logic_id, tenant_id, scope, field_key, natural_language_logic,
                generated_code, explanation, dependencies_json, version, active,
                created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (logic_id, tenant, normalized_scope, normalized_field, logic, code, note, json.dumps(dep), next_version),
        )
    else:
        existing = db_client.fetch_df(
            """
            SELECT COALESCE(MAX(version), 0) AS max_version
            FROM field_logic_rules
            WHERE tenant_id = ? AND scope = ? AND field_key = ?
            """,
            (tenant, normalized_scope, normalized_field),
        ).to_dict(orient="records")
        next_version = int((existing[0] or {}).get("max_version") or 0) + 1
        db_client.execute(
            """
            UPDATE field_logic_rules
            SET active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE tenant_id = ? AND scope = ? AND field_key = ?
            """,
            (tenant, normalized_scope, normalized_field),
        )
        logic_id = str(uuid4())
        db_client.execute(
            """
            INSERT INTO field_logic_rules (
                logic_id, tenant_id, scope, field_key, natural_language_logic,
                generated_code, explanation, dependencies_json, version, active,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (logic_id, tenant, normalized_scope, normalized_field, logic, code, note, json.dumps(dep), next_version),
        )

    return {
        "logicId": logic_id,
        "tenantId": tenant,
        "scope": normalized_scope,
        "fieldKey": normalized_field,
        "version": next_version,
        "active": True,
    }


def list_field_logic_rules(
    tenant_id: str | None,
    scope: str | None = None,
    include_inactive: bool = False,
) -> list[dict]:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id) if tenant_id else None
    scope_filter = (scope or "").strip()

    where_clauses: list[str] = []
    params: list = []

    if tenant:
        where_clauses.append("tenant_id = %s")
        params.append(tenant)
    if scope_filter:
        where_clauses.append("scope = %s")
        params.append(scope_filter)
    if not include_inactive:
        where_clauses.append("active = TRUE")

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    if _tx_on_postgres():
        rows = pg_client.execute(
            f"""
            SELECT
                logic_id AS id, tenant_id, scope, field_key, natural_language_logic,
                generated_code, explanation, dependencies_json, version, active,
                created_at, updated_at
            FROM field_logic_rules
            {where_sql}
            ORDER BY updated_at DESC
            """,
            tuple(params),
        )
    else:
        if where_clauses:
            where_sql = where_sql.replace("%s", "?")
        rows = db_client.fetch_df(
            f"""
            SELECT
                logic_id AS id, tenant_id, scope, field_key, natural_language_logic,
                generated_code, explanation, dependencies_json, version, active,
                created_at, updated_at
            FROM field_logic_rules
            {where_sql}
            ORDER BY updated_at DESC
            """,
            tuple(params),
        ).to_dict(orient="records")

    result: list[dict] = []
    for row in rows:
        logic_id = row.get("id") or row.get("logic_id")
        field_key = row.get("field_key") or row.get("fieldKey")
        logic_text = row.get("natural_language_logic") or row.get("logicText") or ""
        generated_code = row.get("generated_code") or row.get("generatedCode") or ""
        dependencies = row.get("dependencies_json") or row.get("dependencies") or {}
        result.append(
            {
                "id": logic_id,
                "logicId": logic_id,
                "tenantId": row.get("tenant_id"),
                "scope": row.get("scope"),
                "field_key": field_key,
                "fieldKey": field_key,
                "natural_language_logic": logic_text,
                "logicText": logic_text,
                "generated_code": generated_code,
                "generatedCode": generated_code,
                "explanation": row.get("explanation") or "",
                "dependencies_json": dependencies,
                "dependencies": dependencies,
                "version": int(row.get("version") or 1),
                "active": bool(row.get("active", True)),
                "createdAt": row.get("created_at"),
                "updatedAt": row.get("updated_at"),
            }
        )
    return result


def process_ai_pricing_template(tenant_id: str | None, template_text: str) -> dict:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)
    template = (template_text or "").strip()
    if not template:
        raise ValueError("template_text is required")

    from app.services.ai_service import evaluate_pricing_template
    
    try:
        ai_result = evaluate_pricing_template(template, tenant_id=tenant)
        summary = ai_result["summary"]
        confidence = ai_result["confidence"]
        detected = ai_result["sectionsDetected"]
    except Exception as e:
        # Fallback if API key is missing or prompt fails
        summary = f"AI Generation Error: {str(e)}"
        confidence = 0.0
        detected = {
            "headerFields": 0,
            "lineItemFields": 0,
            "pricingRules": 0,
            "tableDependencies": 0,
            "calculationPriorities": 0
        }

    processed_result = {
        "summary": summary,
        "confidence": confidence,
        "sectionsDetected": detected,
        "processedAtUtc": datetime.now(timezone.utc).isoformat(),
    }
    config_id = str(uuid4())

    if _tx_on_postgres():
        pg_client.execute(
            """
            INSERT INTO ai_pricing_configurations (
                config_id, tenant_id, template_text, status, summary,
                confidence, processed_result_json, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (config_id, tenant, template, "processed", summary, confidence, json.dumps(processed_result)),
        )
    else:
        db_client.execute(
            """
            INSERT INTO ai_pricing_configurations (
                config_id, tenant_id, template_text, status, summary,
                confidence, processed_result_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (config_id, tenant, template, "processed", summary, confidence, json.dumps(processed_result)),
        )

    return {
        "configId": config_id,
        "tenantId": tenant,
        "status": "processed",
        "summary": summary,
        "confidence": confidence,
        "processedResult": processed_result,
    }
