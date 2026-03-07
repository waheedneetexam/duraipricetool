import argparse
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONT_PUBLIC = ROOT / "frontend" / "public"


def copy_tree(src: Path, dst: Path, exts: set[str], dry_run: bool) -> list[str]:
    logs: list[str] = []
    if not src.exists():
        logs.append(f"SKIP missing: {src}")
        return logs
    for path in src.rglob("*"):
        if path.is_dir():
            continue
        if exts and path.suffix.lower() not in exts:
            continue
        rel = path.relative_to(src)
        target = dst / rel
        if dry_run:
            logs.append(f"DRY-RUN copy {path} -> {target}")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        logs.append(f"COPIED {path} -> {target}")
    return logs


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish docs to frontend/public for static access.")
    parser.add_argument("--dry-run", action="store_true", help="Show actions without copying.")
    args = parser.parse_args()

    exts = {".md", ".html"}
    logs: list[str] = []

    # Sync root readme.html to frontend/public/readme.html
    src_readme = ROOT / "readme.html"
    dst_readme = FRONT_PUBLIC / "readme.html"
    if src_readme.exists():
        if args.dry_run:
            logs.append(f"DRY-RUN copy {src_readme} -> {dst_readme}")
        else:
            dst_readme.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_readme, dst_readme)
            logs.append(f"COPIED {src_readme} -> {dst_readme}")
    else:
        logs.append(f"SKIP missing: {src_readme}")

    logs += copy_tree(ROOT / "Documentation", FRONT_PUBLIC / "Documentation", exts, args.dry_run)
    logs += copy_tree(ROOT / "Library", FRONT_PUBLIC / "Library", exts, args.dry_run)

    for line in logs:
        print(line)


if __name__ == "__main__":
    main()
