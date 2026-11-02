"""Static checks for the site. Python stdlib only."""
import functools
import http.client
import re
import sys
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import NamedTuple
from urllib.parse import unquote, urljoin, urlsplit

# Placeholders that do not exist yet. PR 3 (the placeholder check) adds the files and empties this
# list; widening it is a visible diff.
EXCLUDED = frozenset({"/luraschi-cv.pdf", "/img/runhub.png", "/img/marginalia.png"})


class Problem(NamedTuple):
    file: str
    rule: str
    message: str


class Page(HTMLParser):
    """Collects every start tag as (tag, attrs, line) and the set of ids."""

    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.ids = set()
        self.feed(text)
        self.close()

    def handle_starttag(self, tag, attrs):
        attrs = {name: (value or "") for name, value in attrs}
        self.tags.append((tag, attrs, self.getpos()[0]))
        if "id" in attrs:
            self.ids.add(attrs["id"])

    handle_startendtag = handle_starttag


def parse(path):
    return Page(Path(path).read_text(encoding="utf-8"))


URL_ATTRIBUTES = ("href", "src", "action", "formaction", "xlink:href")


def check_forbidden(path):
    """No script, style element, style attribute or on* handler (AC6)."""
    problems = []
    for tag, attrs, line in parse(path).tags:
        where = f"line {line}"
        if tag == "script":
            problems.append(Problem(str(path), "forbidden-script", f"{where}: <script> element"))
        if tag == "style":
            problems.append(Problem(str(path), "forbidden-style-element", f"{where}: <style> element"))
        for name in URL_ATTRIBUTES:
            # Browsers drop tab, LF and CR anywhere in a URL, so "java&#x09;script:" still runs,
            # and strip C0 controls and spaces from both ends.
            value = re.sub(r"[\t\n\r]", "", attrs.get(name, ""))
            value = re.sub(r"^[\x00-\x20]+|[\x00-\x20]+$", "", value).lower()
            if value.startswith("javascript:"):
                problems.append(
                    Problem(str(path), "forbidden-js-url", f"{where}: javascript: URL in {name} on <{tag}>"))
        for name in attrs:
            if name == "style":
                problems.append(
                    Problem(str(path), "forbidden-style-attr", f"{where}: style attribute on <{tag}>"))
            elif name.startswith("on"):
                problems.append(
                    Problem(str(path), "forbidden-handler", f"{where}: {name} attribute on <{tag}>"))
    return problems


@functools.lru_cache(maxsize=None)
def _ids_of(path):
    return frozenset(parse(path).ids)


def _is_internal(url):
    parts = urlsplit(url)
    return not parts.scheme and not parts.netloc


def _check_url(url, source, line, root, base_url):
    """Resolve one internal URL against the repo root. Returns a Problem or None."""
    parts = urlsplit(urljoin(base_url, url))
    url_path = unquote(parts.path)
    if url_path in EXCLUDED:
        return None
    root = root.resolve()
    where = f"line {line}"
    if "\0" in url_path:
        return Problem(str(source), "missing-target", f"{where}: {url} decodes to a null byte")
    target = (root / url_path.lstrip("/")).resolve()
    # Containment comes before any other filesystem call on the target.
    if not target.is_relative_to(root):
        return Problem(str(source), "outside-root", f"{where}: {url} leaves the repo root")
    if target.is_dir():
        target = target / "index.html"
    if not target.is_file():
        return Problem(str(source), "missing-target", f"{where}: {url} does not resolve to a file")
    fragment = unquote(parts.fragment)
    if fragment and target.suffix == ".html" and fragment not in _ids_of(target):
        return Problem(str(source), "missing-fragment", f"{where}: {url} has no element with id {fragment!r}")
    return None


def check_links(path, root, url_path):
    """Every internal href and src of a page resolves (AC2). url_path is the page's own URL path."""
    problems = []
    for tag, attrs, line in parse(path).tags:
        for name in ("href", "src"):
            url = attrs.get(name, "").strip()
            if url and _is_internal(url):
                problem = _check_url(url, path, line, root, url_path)
                if problem:
                    problems.append(problem)
    return problems


TEXT_TOKENS = ("--text", "--muted", "--accent")
# Focus ring (--accent), tag border (--muted), chip border (--text). --hair is decorative.
UI_TOKENS = ("--accent", "--muted", "--text")
BACKGROUNDS = ("--bg", "--surface")
TEXT_MIN = 4.5
UI_MIN = 3.0
_ALL_TOKENS = tuple(dict.fromkeys(TEXT_TOKENS + UI_TOKENS + BACKGROUNDS))


def _strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)


def _declarations(block):
    """Raw custom-property values; the last declaration may omit its semicolon."""
    return {name: value.strip() for name, value in re.findall(r"(--[\w-]+)\s*:\s*([^;}]*)", block)}


def _supported(value):
    return re.fullmatch(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})", value) is not None


def _token_blocks(css):
    """Return (light, dark) token dicts; dark is None when the dark block is absent."""
    css = _strip_comments(css)
    light = re.search(r":root\s*\{([^}]*)\}", css)
    dark = re.search(
        r"@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{\s*:root\s*\{([^}]*)\}", css)
    return (
        _declarations(light.group(1)) if light else {},
        _declarations(dark.group(1)) if dark else None,
    )


def _luminance(hex_colour):
    digits = hex_colour.lstrip("#")
    if len(digits) == 3:
        digits = "".join(c * 2 for c in digits)
    channels = []
    for i in (0, 2, 4):
        c = int(digits[i:i + 2], 16) / 255
        channels.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def _ratio(fg, bg):
    lighter, darker = sorted((_luminance(fg), _luminance(bg)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def contrast_report(css):
    """Every checked pair as (scheme, fg, bg, ratio, threshold), passing or not (AC5)."""
    light, dark = _token_blocks(css)
    schemes = {"light": light}
    if dark is not None:
        schemes["dark"] = {**light, **dark}
    rows = []
    for scheme, tokens in schemes.items():
        # A token with an unsupported value is reported by check_contrast, never read here.
        tokens = {name: value for name, value in tokens.items() if _supported(value)}
        for tokens_for, threshold in ((TEXT_TOKENS, TEXT_MIN), (UI_TOKENS, UI_MIN)):
            for fg in tokens_for:
                for bg in BACKGROUNDS:
                    if fg in tokens and bg in tokens:
                        rows.append((scheme, fg, bg, _ratio(tokens[fg], tokens[bg]), threshold))
    return rows


def check_contrast(css, name):
    """Turn missing tokens, a missing dark block and failing pairs into problems (AC5)."""
    light, dark = _token_blocks(css)
    problems = []
    for token in _ALL_TOKENS:
        if token not in light:
            problems.append(Problem(str(name), "missing-token", f"{token} is not defined in :root"))
    for scheme, block in (("light", light), ("dark", dark or {})):
        for token in _ALL_TOKENS:
            if token in block and not _supported(block[token]):
                problems.append(Problem(
                    str(name), "missing-token",
                    f"{scheme}: {token} has unsupported value {block[token]!r}; use 3 or 6 digit hex"))
    if dark is None:
        problems.append(Problem(
            str(name), "missing-dark-block", "no @media (prefers-color-scheme: dark) :root block"))
    for scheme, fg, bg, ratio, threshold in contrast_report(css):
        if ratio < threshold:
            rule = "contrast-text" if threshold == TEXT_MIN else "contrast-ui"
            problems.append(Problem(
                str(name), rule, f"{scheme}: {fg} on {bg} is {ratio:.2f}:1, needs {threshold}:1"))
    return problems


def check_css_assets(path, root, url_path):
    """Every url() in a stylesheet resolves (AC2). url_path is the stylesheet's own URL path."""
    problems = []
    text = Path(path).read_text(encoding="utf-8")
    for match in re.finditer(r"url\(\s*(['\"]?)(.*?)\1\s*\)", text):
        url = match.group(2).strip()
        if url and _is_internal(url):
            line = text.count("\n", 0, match.start()) + 1
            problem = _check_url(url, path, line, root, url_path)
            if problem:
                problems.append(problem)
    return problems


# ---------- External links (--external only) ----------
TIMEOUT = 10
ATTEMPTS = 3
BACKOFF = 2
MAX_HOPS = 5


def external_urls(path):
    """http(s) and protocol-relative links of a page. mailto: and tel: are never fetched."""
    urls = []
    for _, attrs, _ in parse(path).tags:
        for name in ("href", "src"):
            url = attrs.get(name, "").strip()
            if url.startswith("//"):
                url = "https:" + url
            if urlsplit(url).scheme in ("http", "https") and url not in urls:
                urls.append(url)
    return urls


def build_opener():
    """An opener with no redirect handler (the stdlib one reads redirect bodies) and no cookies."""
    opener = urllib.request.OpenerDirector()
    for handler in (urllib.request.UnknownHandler(), urllib.request.HTTPHandler(),
                    urllib.request.HTTPSHandler(), urllib.request.HTTPDefaultErrorHandler(),
                    urllib.request.HTTPErrorProcessor()):
        opener.add_handler(handler)
    return opener


def status_ok(status, url):
    """2xx passes; LinkedIn answers every bot with 999, which also passes (owner decision)."""
    if 200 <= status < 300:
        return True
    host = urlsplit(url).hostname or ""
    return status == 999 and (host == "linkedin.com" or host.endswith(".linkedin.com"))


def _request(opener, url, method):
    """One request, no body read. Returns (status, Location header or None)."""
    request = urllib.request.Request(url, method=method, headers={"User-Agent": "site-checks"})
    try:
        response = opener.open(request, timeout=TIMEOUT)
    except urllib.error.HTTPError as error:
        response = error
    try:
        return response.status if hasattr(response, "status") else response.code, \
            response.headers.get("Location")
    finally:
        response.close()


def _final_status(opener, url, method):
    """Follow redirects by hand: at most MAX_HOPS, http(s) targets only."""
    current = url
    for _ in range(MAX_HOPS + 1):
        status, location = _request(opener, current, method)
        if not (300 <= status < 400 and location):
            return status
        current = urljoin(current, location)
        scheme = urlsplit(current).scheme
        if scheme not in ("http", "https"):
            raise ValueError(f"redirect to a {scheme or 'non-http'} target refused")
    raise ValueError(f"more than {MAX_HOPS} redirects")


def _attempt(opener, url):
    """Returns None on success or a failure reason. HEAD first, GET when HEAD is not a pass."""
    try:
        status = _final_status(opener, url, "HEAD")
    except (OSError, http.client.HTTPException) as error:
        # A timeout (bare or wrapped in URLError) would only repeat on GET, and a ValueError is a
        # redirect-policy failure: both fail now. Other transport errors: some servers drop HEAD.
        if isinstance(error, TimeoutError) or isinstance(getattr(error, "reason", None), TimeoutError):
            raise
        status = None
    if status is None or not status_ok(status, url):
        status = _final_status(opener, url, "GET")
    return None if status_ok(status, url) else f"HTTP {status}"


def check_external_url(url, sleep=time.sleep, attempts=ATTEMPTS):
    reason = None
    for attempt in range(attempts):
        if attempt:
            sleep(BACKOFF)
        try:
            reason = _attempt(build_opener(), url)
        except (OSError, ValueError, http.client.HTTPException) as error:
            reason = f"{type(error).__name__}: {error}"
        if reason is None:
            return None
    return Problem(url, "external-link", f"{reason} after {attempts} attempts")


# ---------- Entry point ----------
ROOT = Path(__file__).resolve().parent.parent
PAGES = (("index.html", "/"), ("how-i-work/index.html", "/how-i-work/"))
STYLESHEET = ("style.css", "/style.css")


def _print(problems):
    for problem in problems:
        print(f"{problem.file}: {problem.rule}: {problem.message}")


def main(argv=None, root=ROOT, external_checker=check_external_url):
    """Static checks by default; --external runs only the link fetcher. Returns the exit code."""
    argv = sys.argv[1:] if argv is None else argv
    problems = []
    if "--external" in argv:
        urls = []
        for page, _ in PAGES:
            urls += [u for u in external_urls(root / page) if u not in urls]
        problems = [p for p in map(external_checker, urls) if p]
    else:
        for page, url_path in PAGES:
            problems += check_forbidden(root / page)
            problems += check_links(root / page, root, url_path)
        css_file, css_url = STYLESHEET
        css = (root / css_file).read_text(encoding="utf-8")
        problems += check_css_assets(root / css_file, root, css_url)
        problems += check_contrast(css, css_file)
        for scheme, fg, bg, ratio, threshold in contrast_report(css):
            print(f"contrast: {scheme} {fg} on {bg} {ratio:.2f}:1 (needs {threshold}:1)")
    _print(problems)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
