"""Static checks for the site. Python stdlib only."""
import functools
import http.client
import re
import sys
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from xml.etree import ElementTree
from pathlib import Path
from typing import NamedTuple
from urllib.parse import unquote, urljoin, urlsplit

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


def _split(url):
    """urlsplit, or None when the URL is malformed (the link checks report it)."""
    try:
        return urlsplit(url)
    except ValueError:
        return None


def _is_internal(url):
    parts = _split(url)
    return parts is not None and not parts.scheme and not parts.netloc


def _malformed(source, line, url):
    return Problem(str(source), "malformed-url", f"line {line}: {url} is not a valid URL")


def _check_url(url, source, line, root, base_url):
    """Resolve one internal URL against the repo root. Returns a Problem or None."""
    parts = urlsplit(urljoin(base_url, url))
    url_path = unquote(parts.path)
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


ASCII_WHITESPACE = " \t\n\f\r"


def _srcset_urls(value):
    """Candidate URLs of a srcset, as the HTML parsing rule reads them (ASCII whitespace only)."""
    urls = []
    i, n = 0, len(value)
    while True:
        while i < n and (value[i] in ASCII_WHITESPACE or value[i] == ","):
            i += 1
        if i >= n:
            return urls
        start = i
        while i < n and value[i] not in ASCII_WHITESPACE:
            i += 1
        url = value[start:i]
        if url.endswith(","):
            urls.append(url.rstrip(","))
            continue
        urls.append(url)
        # The HTML rule has one in-parentheses state: "(" enters it, the first ")" leaves it.
        in_parens = False
        while i < n and not (value[i] == "," and not in_parens):
            if value[i] == "(":
                in_parens = True
            elif value[i] == ")":
                in_parens = False
            i += 1


SRCSET_ATTRIBUTES = ("srcset", "imagesrcset")


def _attr_urls(attrs):
    """(attribute, url) for every URL a tag points at: URL attributes and srcset candidates."""
    for name, value in attrs.items():
        if name in URL_ATTRIBUTES:
            if value.strip():
                yield name, value.strip()
        elif name in SRCSET_ATTRIBUTES:
            for url in _srcset_urls(value):
                yield name, url


def check_links(path, root, url_path):
    """Every internal URL of a page resolves and none is malformed (AC2). url_path is the page's own URL path."""
    problems = []
    for tag, attrs, line in parse(path).tags:
        for _, url in _attr_urls(attrs):
            if _split(url) is None:
                problems.append(_malformed(path, line, url))
            elif _is_internal(url):
                problem = _check_url(url, path, line, root, url_path)
                if problem:
                    problems.append(problem)
    return problems


PLACEHOLDER_PATTERN = re.compile(
    r"\bYOUR-[A-Z][A-Z0-9_-]*|\b(?:TODO|TBD|FIXME|XXX)\b|(?i:lorem\s+ipsum)"
    r"|(?i:\bcoming\s+soon\b|\bcase\s+study\s+coming\b)")
DUMMY_HOST = re.compile(r"(?:.+\.)?example\.(?:com|org|net)", re.IGNORECASE)


class _Placeholders(HTMLParser):
    """Collects (line, where, value): text and comments as read, attributes by name."""

    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.found = []
        self.feed(text)
        self.close()

    def handle_data(self, data):
        self.found.append((self.getpos()[0], "text", data))

    def handle_comment(self, data):
        self.found.append((self.getpos()[0], "comment", data))

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            self.found.append((self.getpos()[0], name, value or ""))

    handle_startendtag = handle_starttag


def _is_dummy_url(url):
    # Browsers read "\" as "/" in http(s) URLs and ignore a trailing dot on the host.
    parts = _split(url.replace("\\", "/"))
    host = parts.hostname if parts else None  # a malformed URL is check_links' to report
    return host is not None and DUMMY_HOST.fullmatch(host.rstrip(".")) is not None


def check_placeholders(path):
    """Marker tokens, filler text, dummy hosts and empty links left in a page (rule placeholder)."""
    problems = []

    def add(line, token, where):
        problems.append(Problem(str(path), "placeholder", f"line {line}: {token} in {where}"))

    for line, where, value in _Placeholders(Path(path).read_text(encoding="utf-8")).found:
        for match in PLACEHOLDER_PATTERN.finditer(value):
            add(line + value.count("\n", 0, match.start()), match.group(), where)
        for _, url in _attr_urls({where: value}):
            if _is_dummy_url(url):
                add(line, url, where)
        if where == "href" and value.strip() in ("", "#"):
            add(line, repr(value), where)
    return problems


TEXT_TOKENS = ("--text", "--muted", "--accent")
# Focus ring and tag border (--accent), list markers (--muted), chip border (--text). --hair is decorative.
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


COLOUR_LITERAL = re.compile(
    r"#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(", re.IGNORECASE)
# Non-colour words allowed in colour-valued properties; any other bare word is a named colour.
COLOUR_KEYWORDS = {
    "none", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset", "hidden",
    "currentcolor", "transparent", "inherit", "initial", "unset", "revert", "auto", "from-font",
    "underline", "overline", "line-through", "wavy", "thin", "medium", "thick",
    # background shorthand
    "repeat", "no-repeat", "repeat-x", "repeat-y", "space", "round", "center", "top", "bottom",
    "left", "right", "cover", "contain", "scroll", "fixed", "local",
    "padding-box", "border-box", "content-box",
}
# Properties whose value is, or may carry, a colour: `color`, any `*-color`, and the shorthands.
COLOUR_SHORTHANDS = {
    "background", "outline", "text-decoration", "column-rule", "fill", "stroke", "caret",
    "-webkit-text-stroke", "text-emphasis",
}
BORDER_SHORTHAND = re.compile(r"border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?")


def _colour_valued(prop):
    return (prop == "color" or prop.endswith("-color") or prop in COLOUR_SHORTHANDS
            or BORDER_SHORTHAND.fullmatch(prop) is not None)


def _blank_comments(css):
    """Comments become spaces, newlines kept, so offsets still give line numbers."""
    return re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), css, flags=re.DOTALL)


def _without_vars(value):
    """Drop `url(...)`, `!important`, each `var(--name` head and its comma, and the parentheses;
    a var() fallback stays to be scanned."""
    value = re.sub(r"url\([^)]*\)|!\s*important", " ", value, flags=re.IGNORECASE)
    return re.sub(r"var\(\s*--[\w-]+\s*,?|\)", " ", value)


PRINT_COLOUR = re.compile(r"#(?:000(?:000)?|fff(?:fff)?)(?![0-9a-fA-F])|\b(?:black|white)\b", re.IGNORECASE)
COLOUR_TOKENS = _ALL_TOKENS + ("--hair",)


def print_spans(css):
    """(start, end) offsets of the body of each `@media print { ... }` block."""
    spans = []
    for match in re.finditer(r"@media\s+print\s*\{", css, re.IGNORECASE):
        depth, i = 1, match.end()
        while i < len(css) and depth:
            depth += {"{": 1, "}": -1}.get(css[i], 0)
            i += 1
        spans.append((match.end(), i))
    return spans


def check_css_colours(css, name):
    """Colours only through custom properties; no gradients, no shadows (PR 3). Inside
    `@media print`, black and white are allowed, as literals or as colour-token values (PR 5)."""
    css = _blank_comments(css)
    spans = print_spans(css)
    problems = []
    for block in re.finditer(r"\{([^{}]*)\}", css):
        in_print = any(start <= block.start() < end for start, end in spans)
        for decl in re.finditer(r"([\w-]+)\s*:\s*([^;]*)", block.group(1)):
            prop, value = decl.group(1).lower(), decl.group(2).strip()
            line = css.count("\n", 0, block.start(1) + decl.start()) + 1
            where = f"line {line}: {prop}: {value}"
            if in_print and prop in COLOUR_TOKENS and not PRINT_COLOUR.fullmatch(value):
                problems.append(Problem(str(name), "print-colour", where))
            if prop.startswith("--") or prop == "color-scheme":
                continue  # a token definition, or a scheme name, not a colour use
            if in_print:
                value = PRINT_COLOUR.sub(" ", value)
            if "gradient(" in value.lower():
                problems.append(Problem(str(name), "gradient", where))
            elif prop.endswith("shadow") and value.lower() != "none" or "drop-shadow(" in value.lower():
                problems.append(Problem(str(name), "shadow", where))
            elif COLOUR_LITERAL.search(_without_vars(value)):
                problems.append(Problem(str(name), "hard-coded-colour", where))
            elif _colour_valued(prop):
                words = re.findall(r"(?<![\w.-])[a-zA-Z][\w-]*", _without_vars(value))
                if any(w.lower() not in COLOUR_KEYWORDS for w in words if not re.match(r"\d", w)):
                    problems.append(Problem(str(name), "hard-coded-colour", where))
    return problems


def check_css_assets(path, root, url_path):
    """Every url() in a stylesheet resolves (AC2). url_path is the stylesheet's own URL path."""
    problems = []
    text = Path(path).read_text(encoding="utf-8")
    for match in re.finditer(r"url\(\s*(['\"]?)(.*?)\1\s*\)", text):
        url = match.group(2).strip()
        if not url:
            continue
        line = text.count("\n", 0, match.start()) + 1
        if _split(url) is None:
            problems.append(_malformed(path, line, url))
        elif _is_internal(url):
            problem = _check_url(url, path, line, root, url_path)
            if problem:
                problems.append(problem)
    return problems


# ---------- Launch basics: link previews, favicons, robots.txt, sitemap (PR 5) ----------
SITE = "https://nicolasluraschi.dev"
REQUIRED_META = ("og:title", "og:description", "og:image", "og:url", "twitter:card")
OG_IMAGE_SIZE = (1200, 630)
FAVICON_TYPES = ("image/svg+xml", "image/png")


def _site_url(url, source, line, root):
    """An absolute URL on SITE resolves to a file under root. Returns a Problem or None."""
    parts = _split(url)
    if parts is None:
        return _malformed(source, line, url)
    if f"{parts.scheme}://{parts.netloc}" != SITE:
        return Problem(str(source), "off-site-url", f"line {line}: {url} is not on {SITE}")
    return _check_url(parts.path or "/", source, line, root, "/")


def png_size(path):
    """(width, height) from a PNG's IHDR chunk, or None when the file is not a PNG."""
    data = Path(path).read_bytes()[:24]
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")


def head_meta(path):
    """{name or property: (content, line)} for each <meta>; the first one of a name wins."""
    meta = {}
    for tag, attrs, line in parse(path).tags:
        key = attrs.get("property") or attrs.get("name")
        if tag == "meta" and key:
            meta.setdefault(key, (attrs.get("content", "").strip(), line))
    return meta


def check_head(path, root, url_path):
    """Open Graph and Twitter tags, and an SVG favicon with a PNG fallback (PR 5)."""
    problems = []
    meta = head_meta(path)
    value = {key: content for key, (content, _) in meta.items()}

    def add(rule, message):
        problems.append(Problem(str(path), rule, message))

    for key in REQUIRED_META:
        if not value.get(key):
            add("missing-meta", f"no {key}")
    card = value.get("twitter:card")
    if card and card != "summary_large_image":
        add("meta-mismatch", f"twitter:card is {card!r}, needs 'summary_large_image'")
    if value.get("og:description") and value["og:description"] != value.get("description"):
        add("meta-mismatch", "og:description is not the meta description verbatim")
    if value.get("og:url") and value["og:url"] != SITE + url_path:
        add("meta-mismatch", f"og:url is {value['og:url']}, needs {SITE + url_path}")
    image = value.get("og:image")
    if image:
        line = meta["og:image"][1]
        problem = _site_url(image, path, line, root)
        if problem:
            problems.append(problem)
        else:
            # Resolved as _check_url did (dot segments removed), so it is the file it vetted.
            target = root / unquote(urlsplit(urljoin("/", urlsplit(image).path)).path).lstrip("/")
            size = png_size(target) if target.is_file() else None
            if size != OG_IMAGE_SIZE:
                found = "not a PNG" if size is None else "{}x{}".format(*size)
                add("og-image-size", f"line {line}: {image} is {found}, needs 1200x630 PNG")
    icon_types = {attrs.get("type") for tag, attrs, _ in parse(path).tags
                  if tag == "link" and "icon" in attrs.get("rel", "").lower().split()}
    for kind in FAVICON_TYPES:
        if kind not in icon_types:
            add("missing-favicon", f"no <link rel=\"icon\" type=\"{kind}\">")
    return problems


def _missing_file(path):
    return [Problem(str(path), "missing-file", f"{Path(path).name} does not exist")]


def check_robots(path):
    """robots.txt: a `User-agent: *` group, no Disallow rule, and a Sitemap line for /sitemap.xml
    (check_sitemap reports a missing sitemap.xml)."""
    if not Path(path).is_file():
        return _missing_file(path)
    problems, any_agent, sitemaps = [], False, []
    for n, raw in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        field, _, value = raw.split("#", 1)[0].partition(":")
        field, value = field.strip().lower(), value.strip()
        if field == "user-agent" and value == "*":
            any_agent = True
        elif field == "disallow" and value:
            problems.append(Problem(str(path), "robots-disallow", f"line {n}: Disallow: {value}"))
        elif field == "sitemap":
            sitemaps.append((n, value))
    if not any_agent:
        problems.append(Problem(str(path), "robots-agent", "no User-agent: * group"))
    if not sitemaps:
        problems.append(Problem(str(path), "robots-sitemap", "no Sitemap line"))
    for n, url in sitemaps:
        if url != SITE + "/sitemap.xml":
            problems.append(Problem(str(path), "robots-sitemap", f"line {n}: {url}, needs {SITE}/sitemap.xml"))
    return problems


SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def check_sitemap(path, root, pages):
    """sitemap.xml: a well-formed urlset that lists every page, with every <loc> resolving."""
    if not Path(path).is_file():
        return _missing_file(path)
    text = Path(path).read_text(encoding="utf-8")
    try:
        tree = ElementTree.fromstring(text)  # our own committed file, not untrusted input
    except ElementTree.ParseError as error:
        return [Problem(str(path), "sitemap-invalid", f"not well-formed XML: {error}")]
    if tree.tag != SITEMAP_NS + "urlset":
        return [Problem(str(path), "sitemap-invalid", f"root is {tree.tag}, needs a sitemaps.org urlset")]
    problems, locs = [], []
    for loc in tree.iter(SITEMAP_NS + "loc"):
        url = (loc.text or "").strip()
        locs.append(url)
        line = text.count("\n", 0, max(text.find(f">{loc.text}<"), 0)) + 1
        problem = _site_url(url, path, line, root)
        if problem:
            problems.append(problem)
    for _, url_path in pages:
        if SITE + url_path not in locs:
            problems.append(Problem(str(path), "sitemap-missing-page", f"{SITE + url_path} is not listed"))
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
        for _, url in _attr_urls(attrs):
            if url.startswith("//"):
                url = "https:" + url
            parts = _split(url)
            if parts and parts.scheme in ("http", "https") and url not in urls:
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
            problems += check_placeholders(root / page)
            problems += check_head(root / page, root, url_path)
        problems += check_robots(root / "robots.txt")
        problems += check_sitemap(root / "sitemap.xml", root, PAGES)
        css_file, css_url = STYLESHEET
        css = (root / css_file).read_text(encoding="utf-8")
        problems += check_css_assets(root / css_file, root, css_url)
        problems += check_contrast(css, css_file)
        problems += check_css_colours(css, css_file)
        for scheme, fg, bg, ratio, threshold in contrast_report(css):
            print(f"contrast: {scheme} {fg} on {bg} {ratio:.2f}:1 (needs {threshold}:1)")
    _print(problems)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
