#!/usr/bin/env python3
"""
Tăng phiên bản nhất quán qua version.json và frontend/package.json.

Cách dùng:
  python scripts/bump_version.py patch    # 1.0.0 → 1.0.1
  python scripts/bump_version.py minor    # 1.0.0 → 1.1.0
  python scripts/bump_version.py major    # 1.0.0 → 2.0.0
  python scripts/bump_version.py 1.2.3   # đặt thẳng phiên bản
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / "version.json"
PKG_FILE = ROOT / "frontend" / "package.json"


def parse_semver(v: str) -> tuple[int, int, int]:
    m = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", v.strip())
    if not m:
        raise ValueError(f"Phiên bản không hợp lệ: {v!r}")
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def bump(current: str, part: str) -> str:
    major, minor, patch = parse_semver(current)
    if part == "major":
        return f"{major + 1}.0.0"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    if part == "patch":
        return f"{major}.{minor}.{patch + 1}"
    # explicit version
    parse_semver(part)   # validate
    return part


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    arg = sys.argv[1].lower()

    # Load version.json
    data = json.loads(VERSION_FILE.read_text(encoding="utf-8"))
    old = data["version"]
    new = bump(old, arg)

    if old == new:
        print(f"Phiên bản không thay đổi: {old}")
        return

    # Cập nhật version.json
    data["version"] = new
    data["build"] = data.get("build", 0) + 1
    data["date"] = date.today().isoformat()
    VERSION_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    # Cập nhật frontend/package.json
    pkg = json.loads(PKG_FILE.read_text(encoding="utf-8"))
    pkg["version"] = new
    PKG_FILE.write_text(
        json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"✅ Phiên bản: {old} → {new}  (build #{data['build']}, {data['date']})")
    print(f"   version.json       ✓")
    print(f"   frontend/package.json ✓")
    print()
    print(f"Tiếp theo:")
    print(f"  git add version.json frontend/package.json")
    print(f"  git commit -m \"chore: bump version to v{new}\"")
    print(f"  git tag v{new}")
    print(f"  git push && git push --tags")


if __name__ == "__main__":
    main()
