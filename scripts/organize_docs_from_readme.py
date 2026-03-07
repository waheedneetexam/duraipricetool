import argparse
import datetime as dt
import os
import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_README = ROOT / "frontend" / "public" / "readme.html"
FRONT_LIBRARY = ROOT / "frontend" / "public" / "library"
DOCUMENTATION = ROOT / "Documentation"

KNOWN_CATEGORIES = {"Foundation", "Specifications", "Guides", "Implementation", "Maintenance"}


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def parse_frontmatter(md_text: str) -> dict:
    match = re.search(r"^---\s*\n(.*?)\n---\s*\n", md_text, re.S)
    if not match:
        return {}
    raw = match.group(1)
    data = {}
    for line in raw.splitlines():
        if ":" not in line:
            continue
        key, val = line.split(":", 1)
        data[key.strip().lower()] = val.strip()
    return data


def insert_frontmatter(md_text: str, title: str, category: str) -> str:
    created = dt.datetime.utcnow().strftime("%Y-%m-%d")
    fm = (
        "---\n"
        f"title: {title}\n"
        f"category: {category}\n"
        f"description: \n"
        f"created: {created}\n"
        "---\n\n"
    )
    return fm + md_text.lstrip()


def resolve_source_path(source_text: str, all_files: dict[str, list[Path]]) -> Path | None:
    raw = source_text.strip()
    if not raw:
        return None

    candidates = []
    cleaned = raw.lstrip("./")
    candidates.append(ROOT / cleaned)
    candidates.append(ROOT / raw)

    if raw.lower().startswith("library/"):
        candidates.append(ROOT / "Library" / raw.split("/", 1)[1])
        candidates.append(ROOT / "frontend" / "public" / "library" / raw.split("/", 1)[1])
    if raw.lower().startswith("frontend/public/"):
        candidates.append(ROOT / raw)

    if "/" not in raw:
        candidates.append(ROOT / "Documentation" / raw)
        candidates.append(ROOT / "Library" / raw)
        candidates.append(ROOT / "frontend" / "public" / raw)
        candidates.append(ROOT / "frontend" / "public" / "library" / raw)

    for candidate in candidates:
        if candidate.exists():
            return candidate

    basename = os.path.basename(raw)
    matches = all_files.get(basename.lower(), [])
    if len(matches) == 1:
        return matches[0]
    return None


def build_file_index() -> dict[str, list[Path]]:
    files = {}
    for ext in ("*.md", "*.html"):
        for path in ROOT.rglob(ext):
            if "node_modules" in path.parts:
                continue
            files.setdefault(path.name.lower(), []).append(path)
    return files


def determine_md_target(path: Path) -> Path:
    if DOCUMENTATION in path.parents:
        return path
    text = read_text(path)
    meta = parse_frontmatter(text)
    category = meta.get("category", "").title() if meta else ""
    if category not in KNOWN_CATEGORIES:
        category = "Guides"
    target_dir = DOCUMENTATION / category
    return target_dir / path.name


def determine_html_target(path: Path, href: str | None) -> Path:
    if FRONT_LIBRARY in path.parents:
        rel = path.relative_to(FRONT_LIBRARY)
        return FRONT_LIBRARY / rel

    link = href or ""
    match = re.search(r"/(?:library|Library)/(.+\\.html)$", link)
    if match:
        rel = Path(match.group(1))
        return FRONT_LIBRARY / rel

    if (ROOT / "Library") in path.parents:
        rel = path.relative_to(ROOT / "Library")
        return FRONT_LIBRARY / rel

    if (ROOT / "frontend" / "public") in path.parents:
        rel = path.relative_to(ROOT / "frontend" / "public")
        return FRONT_LIBRARY / rel.name

    return FRONT_LIBRARY / path.name


def normalize_href(target_path: Path) -> str:
    rel = target_path.relative_to(FRONT_LIBRARY).as_posix()
    return f"/library/{rel}"


def move_file(src: Path, dst: Path, dry_run: bool, log: list[str]) -> None:
    if src == dst:
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        log.append(f"SKIP (exists): {dst}")
        return
    if dry_run:
        log.append(f"DRY-RUN move {src} -> {dst}")
        return
    shutil.move(str(src), str(dst))
    log.append(f"MOVED {src} -> {dst}")


def update_readme(readme_path: Path, dry_run: bool) -> list[str]:
    html = read_text(readme_path)
    tbody_match = re.search(r'(<tbody id="docsTableBody">)(.*?)(</tbody>)', html, re.S)
    if not tbody_match:
        raise RuntimeError("Could not find docs table body in readme.html")

    all_files = build_file_index()
    rows_html = tbody_match.group(2)
    row_matches = list(re.finditer(r"<tr>.*?</tr>", rows_html, re.S))

    updated_rows = []
    log: list[str] = []

    for row_match in row_matches:
        row = row_match.group(0)
        href_match = re.search(r'href="([^"]+)"', row)
        href = href_match.group(1) if href_match else ""
        code_match = re.search(r"<code>(.*?)</code>", row, re.S)
        source_text = code_match.group(1).strip() if code_match else ""

        src_path = resolve_source_path(source_text, all_files)
        if not src_path:
            log.append(f"NOT FOUND: {source_text}")
            updated_rows.append(row)
            continue

        new_source = source_text
        new_href = href

        if src_path.suffix.lower() == ".md":
            target = determine_md_target(src_path)
            if target != src_path:
                text = read_text(src_path)
                if not parse_frontmatter(text):
                    title = Path(src_path).stem.replace("-", " ").replace("_", " ").title()
                    text = insert_frontmatter(text, title, "Guides")
                    if not dry_run:
                        write_text(src_path, text)
                        log.append(f"FRONTMATTER added: {src_path}")
                    else:
                        log.append(f"DRY-RUN add frontmatter: {src_path}")
            move_file(src_path, target, dry_run, log)
            new_source = str(target.relative_to(ROOT))
        elif src_path.suffix.lower() == ".html":
            target = determine_html_target(src_path, href)
            move_file(src_path, target, dry_run, log)
            new_source = str(target.relative_to(ROOT))
            new_href = normalize_href(target)

        if href_match:
            row = re.sub(r'href="[^"]+"', f'href="{new_href}"', row, count=1)
        if code_match:
            row = re.sub(r"<code>.*?</code>", f"<code>{new_source}</code>", row, count=1, flags=re.S)

        updated_rows.append(row)

    new_rows_html = "\n".join(updated_rows)
    updated_html = html[:tbody_match.start(2)] + "\n" + new_rows_html + "\n" + html[tbody_match.end(2):]

    entry_count = len(updated_rows)
    timestamp = dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    updated_html = re.sub(
        r"Generated:\\s*[^|]+\\|\\s*Total entries:\\s*\\d+",
        f"Generated: {timestamp} | Total entries: {entry_count}",
        updated_html,
    )

    if dry_run:
        log.append(f"DRY-RUN update readme: {readme_path}")
    else:
        write_text(readme_path, updated_html)
        log.append(f"UPDATED readme: {readme_path}")

    return log


def main() -> None:
    parser = argparse.ArgumentParser(description="Organize docs listed in readme.html.")
    parser.add_argument("--readme", default=str(DEFAULT_README), help="Path to readme.html")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without moving files")
    args = parser.parse_args()

    readme_path = Path(args.readme).resolve()
    if not readme_path.exists():
        raise SystemExit(f"readme not found: {readme_path}")

    FRONT_LIBRARY.mkdir(parents=True, exist_ok=True)
    DOCUMENTATION.mkdir(parents=True, exist_ok=True)

    log = update_readme(readme_path, args.dry_run)
    for line in log:
        print(line)


if __name__ == "__main__":
    main()
