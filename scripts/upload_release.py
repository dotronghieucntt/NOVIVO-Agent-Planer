#!/usr/bin/env python3
"""
Upload release assets lên GitHub.

Tự động:
  1. Đọc version từ version.json
  2. Tạo GitHub Release (draft)
  3. Upload exe installer + full zip

Cách dùng:
  python scripts/upload_release.py [--publish]

Flags:
  --publish   Publish ngay (bỏ qua draft mode)

Yêu cầu file .env tại root với:
  GITHUB_USERNAME=...
  GITHUB_TOKEN=...
  GITHUB_REPO=...
"""
import json
import os
import sys
import glob
import mimetypes
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_env(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
    return env


def api(token: str, method: str, url: str, **kwargs):
    import urllib.request
    import urllib.error

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "NOVIVO-Release-Script/1.0",
    }
    body = None
    if "json" in kwargs:
        body = json.dumps(kwargs["json"]).encode()
        headers["Content-Type"] = "application/json"
    elif "data" in kwargs:
        body = kwargs["data"]
        headers["Content-Type"] = kwargs.get("content_type", "application/octet-stream")
        if "content_length" in kwargs:
            headers["Content-Length"] = str(kwargs["content_length"])

    req = urllib.request.Request(url, data=body, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read()
        print(f"HTTP {e.code}: {body.decode()[:500]}")
        raise


def main():
    publish = "--publish" in sys.argv

    env = load_env(ROOT / ".env")
    token = env.get("GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN", "")
    owner = env.get("GITHUB_USERNAME") or os.environ.get("GITHUB_USERNAME", "")
    repo = env.get("GITHUB_REPO") or os.environ.get("GITHUB_REPO", "")

    if not all([token, owner, repo]):
        print("❌ Thiếu GITHUB_TOKEN / GITHUB_USERNAME / GITHUB_REPO trong .env")
        sys.exit(1)

    version_data = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    version = version_data["version"]
    build = version_data.get("build", 1)
    changelog = "\n".join(version_data.get("changelog", []))
    tag = f"v{version}"

    print(f"📦 Tạo release {tag} (build #{build})...")

    # 1. Tạo release
    release_url = f"https://api.github.com/repos/{owner}/{repo}/releases"
    payload = {
        "tag_name": tag,
        "name": f"NOVIVO Agent Planer {tag}",
        "body": f"## 📋 Changelog\n\n{changelog}\n\n---\n_Build #{build} | {version_data.get('date', '')}_",
        "draft": not publish,
        "prerelease": False,
    }

    try:
        release = api(token, "POST", release_url, json=payload)
    except Exception:
        print("❌ Không tạo được release. Kiểm tra token và quyền truy cập repo.")
        sys.exit(1)

    upload_base = release["upload_url"].replace("{?name,label}", "")
    release_id = release["id"]
    release_html = release["html_url"]
    print(f"✅ Release tạo thành công: {release_html}")

    # 2. Tìm assets để upload
    patterns = [
        str(ROOT / "frontend" / "dist-electron" / "*.exe"),
        str(ROOT / "dist" / "*.zip"),
        str(ROOT / "dist" / "*.exe"),
    ]
    assets = []
    for pat in patterns:
        assets.extend(glob.glob(pat))

    if not assets:
        print("⚠️  Không tìm thấy file build. Chạy scripts\\build_all.bat trước.")
        print(f"   Release draft đã tạo: {release_html}")
        return

    # 3. Upload từng asset
    for asset_path in assets:
        name = Path(asset_path).name
        size = os.path.getsize(asset_path)
        mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
        print(f"⬆️  Uploading {name} ({size // 1024 // 1024} MB)...")

        with open(asset_path, "rb") as f:
            data = f.read()

        upload_url = f"{upload_base}?name={name}"
        api(
            token, "POST", upload_url,
            data=data,
            content_type=mime,
            content_length=size
        )
        print(f"   ✅ {name}")

    status = "Published" if publish else "Draft"
    print(f"\n🎉 Release {tag} ({status}): {release_html}")


if __name__ == "__main__":
    main()
