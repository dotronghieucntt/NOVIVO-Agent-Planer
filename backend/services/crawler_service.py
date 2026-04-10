"""
Web Crawler Service — crawls a URL and all sub-pages within the same domain,
extracting clean text content for the AI knowledge base.

Pure stdlib HTML parser + httpx (already a dep). No extra packages needed.
"""
import asyncio
import logging
import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)


# ── HTML → clean text ────────────────────────────────────────────────────────

class _TextExtractor(HTMLParser):
    """Strips scripts/styles and extracts visible text."""

    _SKIP = {"script", "style", "noscript", "iframe", "svg", "head", "meta", "link"}
    _BLOCK = {"p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li", "div", "tr", "section", "article"}

    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP:
            self._skip_depth += 1
        if tag in self._BLOCK:
            self._parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self._SKIP and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data):
        if self._skip_depth == 0:
            text = data.strip()
            if text:
                self._parts.append(text)

    def result(self) -> str:
        raw = " ".join(self._parts)
        raw = re.sub(r"[ \t]+", " ", raw)
        raw = re.sub(r"\n[ \t]+", "\n", raw)
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        return raw.strip()


def _get_title(html: str) -> str:
    m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I | re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def _get_links(html: str, page_url: str) -> list[str]:
    links: list[str] = []
    for m in re.finditer(r'''href\s*=\s*["']([^"'#\s]+)''', html, re.I):
        href = m.group(1)
        if any(href.startswith(p) for p in ("mailto:", "tel:", "javascript:", "data:", "void")):
            continue
        full = urljoin(page_url, href).split("#")[0]
        links.append(full)
    return links


_SKIP_EXTS = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".zip", ".mp4", ".mp3",
              ".docx", ".xlsx", ".pptx", ".exe", ".css", ".js", ".ico", ".svg", ".webp"}


async def crawl_site(
    start_url: str,
    max_pages: int = 30,
    max_depth: int = 2,
    delay: float = 0.3,
) -> list[dict]:
    """
    Crawl start_url and all sub-pages within the same domain.
    Returns list of {'url': str, 'title': str, 'content': str}.
    """
    origin = urlparse(start_url)
    domain = origin.netloc

    visited: set[str] = set()
    queue: list[tuple[str, int]] = [(start_url, 0)]
    results: list[dict] = []

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0 Safari/537.36"
        ),
        "Accept-Language": "vi,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml",
    }

    import httpx

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(20.0, connect=8.0),
        follow_redirects=True,
        headers=headers,
    ) as client:
        while queue and len(visited) < max_pages:
            url, depth = queue.pop(0)

            # Skip already-visited or off-domain
            if url in visited:
                continue
            if urlparse(url).netloc != domain:
                continue

            # Skip non-HTML file extensions
            path_lower = urlparse(url).path.lower()
            if any(path_lower.endswith(ext) for ext in _SKIP_EXTS):
                continue

            visited.add(url)

            try:
                resp = await client.get(url)
                if resp.status_code >= 400:
                    continue

                ctype = resp.headers.get("content-type", "")
                if "html" not in ctype:
                    continue

                html = resp.text
                title = _get_title(html) or urlparse(url).path or url

                extractor = _TextExtractor()
                try:
                    extractor.feed(html)
                except Exception:
                    pass
                text = extractor.result()

                if len(text) > 150:
                    results.append({"url": url, "title": title, "content": text})
                    logger.info("Crawled [%d/%d] %s (%d chars)", len(results), max_pages, url, len(text))

                # Queue child links
                if depth < max_depth:
                    for link in _get_links(html, url):
                        lp = urlparse(link)
                        link_path_lower = lp.path.lower()
                        if (
                            lp.netloc == domain
                            and link not in visited
                            and not any(link_path_lower.endswith(ext) for ext in _SKIP_EXTS)
                        ):
                            queue.append((link, depth + 1))

                if delay > 0:
                    await asyncio.sleep(delay)

            except Exception as exc:
                logger.warning("Crawl error %s: %s", url, exc)

    logger.info("Crawl done: %d pages from %s", len(results), start_url)
    return results
