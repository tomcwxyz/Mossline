#!/usr/bin/env python3
"""One-off: move the legacy studio styles (apps/web/src/app/globals.css) onto
the Field Atlas tokens, so Advanced tools, recovery and shared views follow the
same palette, fonts and Night/Day setting as the atlas.

The legacy sheet was written for a dark green UI with ~1,100 literal colours.
Each literal is replaced by the atlas token that plays the same role, judged
from the CSS property it sets (surface, text, line, shadow) and the colour's
hue and lightness. Rules for the legacy graph canvases are left alone: their
JavaScript renderers draw light marks for a dark plate.

Usage: python3 scripts/retheme-legacy-css.py apps/web/src/app/globals.css
"""
import colorsys
import re
import sys

PLATE = re.compile(r"graph-canvas|whole-graph-(stage|canvas)|full-network-(stage|canvas)|map-panel|"
                   r"atlas-canvas|graph-stage\.illustrated|connection-reader-figure|orbit")
COLOUR = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)")


def parse(c):
    if c.startswith("#"):
        h = c[1:]
        if len(h) in (3, 4):
            h = "".join(x * 2 for x in h)
        r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
    else:
        parts = [p.strip() for p in re.split(r"[,\s/]+", c[c.index("(") + 1:-1]) if p.strip()]
        r, g, b = (float(p) / 255 for p in parts[:3])
        a = float(parts[3]) if len(parts) > 3 else 1.0
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return h * 360, s, l, a


def family(h, s, l):
    if s < 0.16 or l < 0.08:
        return "neutral"
    if h < 22 or h > 335:
        return "red"
    if h < 60:
        return "gold"
    if 175 <= h < 250:
        return "blue"
    if 250 <= h <= 335:
        return "purple"
    return "green"


BUTTON = re.compile(r"button|btn|primary|solid|cta|\.find\b")


def surface(h, s, l, buttonish=False):
    f = family(h, s, l)
    # A dark green fill on a control is an emphasised action: moss in both themes.
    if buttonish and f == "green" and s > 0.15 and l < 0.45:
        return "--ml-moss"
    if f == "red":
        return "--ml-danger-soft" if l > 0.7 else "--ml-danger"
    if f == "gold":
        return "--ml-warn-soft" if l > 0.8 else "--ml-project"
    if f == "blue":
        return "--ml-info-soft" if l > 0.8 else "--ml-funder"
    if f == "purple":
        return "--ml-person"
    if l > 0.86:
        return "--ml-surface"
    if f == "green" and s > 0.18 and 0.5 <= l <= 0.86:
        return "--ml-moss"
    if l > 0.72:
        return "--ml-sunken"
    if l < 0.13:
        return "--ml-paper"
    if l < 0.2:
        return "--ml-raised"
    if l < 0.5:
        return "--ml-sunken"
    return "--ml-border-strong"


def text(h, s, l, on):
    f = family(h, s, l)
    if on in ("--ml-moss", "--ml-funder", "--ml-danger", "--ml-project", "--ml-person"):
        return "--ml-on-moss"
    if f == "red":
        return "--ml-danger"
    if f in ("gold", "blue"):
        return "--ml-link"
    if f == "purple":
        return "--ml-person"
    if l >= 0.8:
        return "--ml-ink"
    if l >= 0.6:
        return "--ml-muted"
    if l >= 0.42:
        return "--ml-subtle"
    return "--ml-ink"


def line(h, s, l, buttonish=False):
    f = family(h, s, l)
    if buttonish and f == "green" and s > 0.15 and l < 0.45:
        return "--ml-moss"
    if f == "red":
        return "--ml-danger"
    if f == "gold":
        return "--ml-project"
    if f == "blue":
        return "--ml-funder"
    if f == "green" and s > 0.3 and 0.45 <= l <= 0.85:
        return "--ml-moss"
    return "--ml-border" if l < 0.5 else "--ml-border-strong"


def token(c, kind, on=None, buttonish=False):
    h, s, l, a = parse(c)
    if kind == "shadow":
        return f"rgba(0,0,0,{round(min(0.35, a * 0.7), 3)})" if l < 0.5 else "transparent"
    if kind == "halo":
        name = "--ml-paper"
    elif kind == "text":
        name = text(h, s, l, on)
    elif kind == "line":
        name = line(h, s, l, buttonish)
    else:
        name = surface(h, s, l, buttonish)
    if a >= 0.995:
        return f"var({name})"
    return f"color-mix(in srgb, var({name}) {round(a * 100)}%, transparent)"


def kind_of(prop):
    p = prop.strip().lower()
    if p in ("color", "caret-color", "-webkit-text-fill-color"):
        return "text"
    if p.startswith("border") or p.startswith("outline") or p in ("stroke", "text-decoration-color", "column-rule", "text-decoration"):
        return "line"
    if p == "box-shadow":
        return "shadow"
    if p == "text-shadow":
        return "halo"
    if p == "accent-color":
        return "accent"
    return "surface"


LIGHT_VARIANT = re.compile(r"editorial-style|illustrated")


def convert_block(selector, body):
    # Dark canvas plates keep their colours; their light variants do not.
    if PLATE.search(selector) and not LIGHT_VARIANT.search(selector):
        return body
    decls = body.split(";")
    buttonish = bool(BUTTON.search(selector))
    # Find the rule's own surface first, so text on accent fills gets on-moss.
    on = None
    for d in decls:
        if ":" in d:
            prop, val = d.split(":", 1)
            if kind_of(prop) == "surface" and prop.strip().lower() in ("background", "background-color"):
                m = COLOUR.search(val)
                if m:
                    h, s, l, a = parse(m.group(0))
                    on = surface(h, s, l, buttonish)
    out = []
    for d in decls:
        if ":" not in d or d.strip().startswith("--"):
            out.append(d)
            continue
        prop, val = d.split(":", 1)
        k = kind_of(prop)
        if k == "accent":
            val = COLOUR.sub("var(--ml-moss)", val)
        else:
            val = COLOUR.sub(lambda m: token(m.group(0), k, on, buttonish), val)
        # Named white: a light surface, or text on a filled control.
        if k == "surface":
            val = re.sub(r"\bwhite\b", "var(--ml-surface)", val)
        elif k == "text":
            val = re.sub(r"\bwhite\b", "var(--ml-on-moss)" if on in ("--ml-moss", "--ml-funder", "--ml-danger") else "var(--ml-ink)", val)
        val = re.sub(r"Georgia\s*,\s*(\"Times New Roman\"\s*,\s*)?serif", "var(--ml-serif)", val)
        val = re.sub(r"Arial\s*,\s*Helvetica\s*,\s*sans-serif", "var(--ml-sans)", val)
        out.append(prop + ":" + val)
    return ";".join(out)


def walk(css):
    """Rewrite every declaration block, recursing into @media and similar."""
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            out.append(css[i:])
            break
        selector = css[i:j]
        # Comments may sit in the selector text; keep them.
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
            k += 1
        inner = css[j + 1:k - 1]
        if selector.strip().startswith("@") and "{" in inner:
            out.append(selector + "{" + walk(inner) + "}")
        elif selector.strip().startswith("@"):
            out.append(selector + "{" + inner + "}")
        else:
            out.append(selector + "{" + convert_block(re.sub(r"/\*.*?\*/", "", selector, flags=re.S), inner) + "}")
        i = k
    return "".join(out)


if __name__ == "__main__":
    path = sys.argv[1]
    css = open(path).read()
    open(path, "w").write(walk(css))
