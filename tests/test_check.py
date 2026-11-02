"""Self-tests for scripts/check.py. Each rule is proven by a fixture that breaks only that rule."""
import contextlib
import io
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
FIXTURES = REPO / "tests" / "fixtures"
sys.path.insert(0, str(REPO / "scripts"))

import check  # noqa: E402


def rules(problems):
    return [p.rule for p in problems]


class ForbiddenMarkupTest(unittest.TestCase):
    def test_script_element(self):
        problems = check.check_forbidden(FIXTURES / "forbidden-script.html")
        self.assertEqual(["forbidden-script"], rules(problems))
        self.assertTrue(problems[0].file.endswith("forbidden-script.html"))

    def test_style_attribute(self):
        problems = check.check_forbidden(FIXTURES / "forbidden-style-attr.html")
        self.assertEqual(["forbidden-style-attr"], rules(problems))

    def test_style_element(self):
        problems = check.check_forbidden(FIXTURES / "forbidden-style-element.html")
        self.assertEqual(["forbidden-style-element"], rules(problems))

    def test_event_handler_attribute(self):
        problems = check.check_forbidden(FIXTURES / "forbidden-handler.html")
        self.assertEqual(["forbidden-handler"], rules(problems))

    def test_javascript_url(self):
        problems = check.check_forbidden(FIXTURES / "forbidden-js-url.html")
        self.assertEqual(["forbidden-js-url"], rules(problems))

    def test_javascript_url_behind_a_raw_leading_control_character(self):
        # Built at run time: a raw control byte does not belong in a committed fixture.
        with tempfile.TemporaryDirectory() as tmp:
            page = Path(tmp) / "page.html"
            page.write_text('<!doctype html><html lang="en"><body><a href="\x01javascript:x">x</a></body></html>')
            self.assertEqual(["forbidden-js-url"], rules(check.check_forbidden(page)))

    def test_javascript_url_with_an_entity_encoded_tab(self):
        problems = check.check_forbidden(FIXTURES / "forbidden-js-url-entity.html")
        self.assertEqual(["forbidden-js-url"], rules(problems))

    def test_javascript_url_in_a_form_action(self):
        problems = check.check_forbidden(FIXTURES / "forbidden-js-url-action.html")
        self.assertEqual(["forbidden-js-url"], rules(problems))

    def test_site_pages_are_clean(self):
        for page in ("index.html", "how-i-work/index.html"):
            self.assertEqual([], check.check_forbidden(REPO / page), page)


def url_of(path):
    return "/" + Path(path).relative_to(REPO).as_posix()


def link_problems(name):
    path = FIXTURES / name
    return check.check_links(path, REPO, url_of(path))


class LinksTest(unittest.TestCase):
    def test_missing_root_relative_target(self):
        self.assertEqual(["missing-target"], rules(link_problems("link-missing-root.html")))

    def test_missing_relative_src(self):
        self.assertEqual(["missing-target"], rules(link_problems("link-missing-relative.html")))

    def test_url_decoding_outside_root(self):
        problems = link_problems("link-outside-root.html")
        self.assertEqual(["outside-root"], rules(problems))

    def test_null_byte_is_reported_not_raised(self):
        self.assertEqual(["missing-target"], rules(link_problems("link-null-byte.html")))

    def test_missing_same_page_fragment(self):
        self.assertEqual(["missing-fragment"], rules(link_problems("link-fragment-same.html")))

    def test_missing_cross_page_fragment(self):
        self.assertEqual(["missing-fragment"], rules(link_problems("link-fragment-cross.html")))

    def test_valid_links_pass(self):
        # Directories resolve to index.html, fragments exist, protocol-relative and absolute URLs
        # are external, and the three excluded paths are skipped.
        self.assertEqual([], link_problems("link-ok.html"))

    def test_site_pages_pass(self):
        self.assertEqual([], check.check_links(REPO / "index.html", REPO, "/"))
        self.assertEqual(
            [], check.check_links(REPO / "how-i-work" / "index.html", REPO, "/how-i-work/"))

    def test_missing_css_asset(self):
        path = FIXTURES / "missing-asset.css"
        problems = check.check_css_assets(path, REPO, url_of(path))
        self.assertEqual(["missing-target"], rules(problems))

    def test_site_stylesheet_passes(self):
        self.assertEqual([], check.check_css_assets(REPO / "style.css", REPO, "/style.css"))

    def test_excluded_paths_are_exactly_the_three_placeholders(self):
        self.assertEqual(
            frozenset({"/luraschi-cv.pdf", "/img/runhub.png", "/img/marginalia.png"}),
            check.EXCLUDED)


class ContrastTest(unittest.TestCase):
    def css(self, name):
        return (FIXTURES / name).read_text(encoding="utf-8") if name != "style.css" else (
            REPO / "style.css").read_text(encoding="utf-8")

    def test_report_lists_every_pair_in_both_schemes(self):
        rows = check.contrast_report(self.css("style.css"))
        # 3 text tokens + 3 UI tokens, on 2 backgrounds, in 2 schemes.
        self.assertEqual(24, len(rows))
        self.assertEqual({"light", "dark"}, {row[0] for row in rows})
        self.assertEqual(12, len([row for row in rows if row[4] == 4.5]))
        self.assertEqual(12, len([row for row in rows if row[4] == 3.0]))

    def test_lowest_ratio_is_light_muted_on_surface(self):
        scheme, fg, bg, ratio, _ = min(check.contrast_report(self.css("style.css")), key=lambda r: r[3])
        self.assertEqual(("light", "--muted", "--surface", 5.85), (scheme, fg, bg, round(ratio, 2)))

    def test_site_stylesheet_passes(self):
        self.assertEqual([], check.check_contrast(self.css("style.css"), "style.css"))

    def test_low_contrast_fixture_names_the_pair_and_ratio(self):
        problems = check.check_contrast(self.css("contrast-low.css"), "contrast-low.css")
        text = [p for p in problems if p.rule == "contrast-text"]
        self.assertIn("contrast-ui", rules(problems))
        self.assertTrue(any("--muted on --bg" in p.message and "light" in p.message for p in text))
        self.assertTrue(any("2.35:1" in p.message for p in text), [p.message for p in text])

    def test_missing_token_fails(self):
        problems = check.check_contrast(self.css("contrast-missing-token.css"), "contrast-missing-token.css")
        self.assertEqual(["missing-token"], rules(problems))
        self.assertIn("--accent", problems[0].message)

    def test_four_digit_hex_is_a_missing_token_not_a_crash(self):
        problems = check.check_contrast(self.css("contrast-bad-hex.css"), "contrast-bad-hex.css")
        self.assertEqual(["missing-token"], rules(problems))
        self.assertIn("--text", problems[0].message)

    def test_unsupported_dark_value_is_reported_not_inherited_from_light(self):
        problems = check.check_contrast(self.css("contrast-dark-8digit.css"), "contrast-dark-8digit.css")
        self.assertEqual(["missing-token"], rules(problems))
        self.assertIn("dark", problems[0].message)
        self.assertIn("--bg", problems[0].message)

    def test_last_declaration_without_a_semicolon_is_read(self):
        css = self.css("contrast-no-semicolon.css")
        self.assertEqual([], check.check_contrast(css, "contrast-no-semicolon.css"))
        self.assertEqual(24, len(check.contrast_report(css)))

    def test_missing_dark_block_fails(self):
        problems = check.check_contrast(self.css("contrast-missing-dark.css"), "contrast-missing-dark.css")
        self.assertEqual(["missing-dark-block"], rules(problems))


BIG = 64 * 1024 * 1024  # a body no unread-closing client can have received in full
CHUNK = b"x" * 65536


class StubHandler(BaseHTTPRequestHandler):
    """Loopback stub for the external link checker. Behaviour is chosen by path."""

    def log_message(self, *args):
        pass

    def _send_big_body(self):
        sent = 0
        try:
            while sent < BIG:
                self.wfile.write(CHUNK)
                sent += len(CHUNK)
        except OSError:
            pass
        finally:
            self.server.bytes_sent[self.path] = sent
            self.server.body_done.set()

    def _respond(self, method):
        self.server.hits.append((method, self.path))
        path = self.path
        if path == "/always404":
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif path == "/head405":
            code = 405 if method == "HEAD" else 200
            self.send_response(code)
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "/ok")
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif path == "/headdrop":
            if method == "HEAD":
                self.close_connection = True  # no response at all: RemoteDisconnected
                return
            self.send_response(200)
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif path == "/hang":
            time.sleep(1)  # never answers within the injected timeout
        elif path == "/ok":
            self.send_response(200)
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif path == "/code999":
            self.send_response(999)
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif path == "/ftp":
            self.send_response(302)
            self.send_header("Location", "ftp://example.com/x")
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif path == "/loop":
            self.send_response(302)
            self.send_header("Location", "/loop")
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif path in ("/big", "/bigredirect"):
            if method == "HEAD":
                self.send_response(405)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            self.send_response(200 if path == "/big" else 302)
            if path == "/bigredirect":
                self.send_header("Location", "/ok")
            self.send_header("Content-Length", str(BIG))
            self.end_headers()
            self._send_big_body()

    def do_HEAD(self):
        self._respond("HEAD")

    def do_GET(self):
        self._respond("GET")


class ExternalLinksTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), StubHandler)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.server.hits = []
        self.server.bytes_sent = {}
        self.server.body_done = threading.Event()
        self.sleeps = []

    def run_check(self, path):
        return check.check_external_url(self.base + path, sleep=self.sleeps.append)

    def test_404_to_head_and_get_fails_after_three_attempts(self):
        problem = self.run_check("/always404")
        self.assertEqual("external-link", problem.rule)
        self.assertIn("404", problem.message)
        self.assertEqual(3, self.server.hits.count(("HEAD", "/always404")))
        self.assertEqual(3, self.server.hits.count(("GET", "/always404")))
        self.assertEqual(2, len(self.sleeps))

    def test_405_to_head_and_200_to_get_passes(self):
        self.assertIsNone(self.run_check("/head405"))
        self.assertEqual([("HEAD", "/head405"), ("GET", "/head405")], self.server.hits)
        self.assertEqual([], self.sleeps)

    def test_head_connection_dropped_falls_back_to_get(self):
        self.assertIsNone(self.run_check("/headdrop"))
        self.assertIn(("GET", "/headdrop"), self.server.hits)
        self.assertEqual([], self.sleeps)

    def test_302_to_a_200_passes(self):
        self.assertIsNone(self.run_check("/redirect"))

    def test_999_from_a_non_linkedin_host_fails(self):
        self.assertEqual("external-link", self.run_check("/code999").rule)

    def test_redirect_to_a_non_http_scheme_fails_without_following(self):
        problem = self.run_check("/ftp")
        self.assertEqual("external-link", problem.rule)
        self.assertIn("ftp", problem.message)
        # A refused redirect is a policy failure, not a transport error: no GET fallback.
        self.assertNotIn(("GET", "/ftp"), self.server.hits)

    def test_redirect_loop_fails_without_a_get(self):
        self.assertEqual("external-link", self.run_check("/loop").rule)
        self.assertNotIn(("GET", "/loop"), self.server.hits)

    def test_head_timeout_does_not_fall_back_to_get(self):
        with mock.patch.object(check, "TIMEOUT", 0.2):
            problem = check.check_external_url(
                self.base + "/hang", sleep=self.sleeps.append, attempts=1)
        self.assertEqual("external-link", problem.rule)
        self.assertEqual([("HEAD", "/hang")], self.server.hits)

    def test_large_get_body_is_closed_unread(self):
        self.assertIsNone(self.run_check("/big"))
        self.assertTrue(self.server.body_done.wait(10))
        self.assertLess(self.server.bytes_sent["/big"], BIG // 2)

    def test_large_redirect_body_is_closed_unread(self):
        self.assertIsNone(self.run_check("/bigredirect"))
        self.assertTrue(self.server.body_done.wait(10))
        self.assertLess(self.server.bytes_sent["/bigredirect"], BIG // 2)

    def test_unreachable_host_fails(self):
        port = self.server.server_address[1]
        problem = check.check_external_url(
            f"http://127.0.0.1:{port + 1}/", sleep=self.sleeps.append, attempts=1)
        self.assertEqual("external-link", problem.rule)

    def test_linkedin_999_passes_only_on_linkedin_hosts(self):
        ok = check.status_ok
        self.assertTrue(ok(999, "https://www.linkedin.com/in/someone"))
        self.assertTrue(ok(999, "https://linkedin.com/in/someone"))
        self.assertFalse(ok(999, "https://linkedin.com.evil.example/in/x"))
        self.assertFalse(ok(999, "https://notlinkedin.com/"))
        self.assertFalse(ok(999, "https://example.com/"))
        self.assertTrue(ok(200, "https://example.com/"))
        self.assertFalse(ok(404, "https://www.linkedin.com/"))

    def test_opener_has_no_redirect_or_cookie_handler(self):
        names = {type(h).__name__ for h in check.build_opener().handlers}
        self.assertNotIn("HTTPRedirectHandler", names)
        self.assertNotIn("HTTPCookieProcessor", names)

    def test_urls_come_from_http_and_protocol_relative_links_only(self):
        urls = check.external_urls(FIXTURES / "link-ok.html")
        self.assertEqual(["https://example.com/", "https://example.com/x"], sorted(urls))

    def test_site_urls_exclude_mailto(self):
        urls = check.external_urls(REPO / "index.html")
        self.assertFalse([u for u in urls if u.startswith("mailto:")])
        self.assertIn("https://runhub.uy", urls)


class MainTest(unittest.TestCase):
    def run_main(self, argv, **kwargs):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = check.main(argv, **kwargs)
        return code, out.getvalue()

    def make_root(self, tmp, index_html):
        tmp = Path(tmp)
        (tmp / "how-i-work").mkdir()
        (tmp / "index.html").write_text(index_html, encoding="utf-8")
        (tmp / "how-i-work" / "index.html").write_text(
            (REPO / "how-i-work" / "index.html").read_text(encoding="utf-8"), encoding="utf-8")
        (tmp / "style.css").write_text((REPO / "style.css").read_text(encoding="utf-8"), encoding="utf-8")
        return tmp

    def test_exits_zero_on_the_site_and_prints_the_contrast_report(self):
        code, output = self.run_main([])
        self.assertEqual(0, code, output)
        self.assertIn("light --muted on --surface 5.85:1", output)

    def test_exits_one_and_names_file_and_rule_on_a_bad_page(self):
        bad = (FIXTURES / "forbidden-script.html").read_text(encoding="utf-8")
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_root(tmp, bad)
            code, output = self.run_main([], root=root)
        self.assertEqual(1, code)
        self.assertIn("index.html: forbidden-script:", output)

    def test_external_flag_runs_only_the_link_fetcher(self):
        calls = []
        checker = lambda url: calls.append(url)  # noqa: E731
        code, output = self.run_main(["--external"], external_checker=checker)
        self.assertEqual(0, code)
        self.assertIn("https://runhub.uy", calls)
        self.assertNotIn("light --muted", output)

    def test_external_failure_exits_one(self):
        failing = lambda url: check.Problem(url, "external-link", "HTTP 404 after 3 attempts")  # noqa: E731
        code, output = self.run_main(["--external"], external_checker=failing)
        self.assertEqual(1, code)
        self.assertIn("external-link: HTTP 404", output)


if __name__ == "__main__":
    unittest.main()
