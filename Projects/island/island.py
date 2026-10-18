#!/usr/bin/env python3
"""island.py — a Dynamic Island widget for Wayland/niri.

GTK4 + gtk4-layer-shell. A compact pill anchored to the top-center of the
screen that expands on hover/click into a panel with clock, CPU usage and a
mock media track.

Style lives in style.css (next to this file). A font found in ~/Downloads
(any .ttf/.otf, scanned recursively) is loaded via an injected @font-face
rule; without one, the CSS falls back to system fonts.

Requires: python3-gobject, gtk4-layer-shell (Fedora: sudo dnf install
gtk4-layer-shell python3-gobject). Works on niri and other wlroots-style
compositors that implement the layer-shell protocol.

Run: python3 island.py        (or ./island.py)
"""

import ctypes
import os
import sys
import math
import urllib.parse
from time import monotonic


def _ctypes_for_layer_shell() -> None:
    """Try known library names; must run before 'import gi'."""
    candidates = ("libgtk4-layer-shell.so.0", "libgtk4-layer-shell.so")
    for name in candidates:
        try:
            ctypes.CDLL(name, mode=ctypes.RTLD_GLOBAL)
            return
        except OSError:
            continue


# Load gtk4-layer-shell globally BEFORE Gtk links libwayland-client; otherwise
# the layer surface fails to initialize (GI bindings load libs lazily).
_ctypes_for_layer_shell()

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Gtk4LayerShell", "1.0")
from gi.repository import GLib, Gtk
from gi.repository import Gtk4LayerShell

APP_ID = "dev.sam.island"
NAMESPACE = "island"

# Compact "pill" size.
COMPACT_W, COMPACT_H = 180, 36
# Fully expanded panel size.
EXPANDED_W, EXPANDED_H = 380, 150
# Expand/collapse animation length in milliseconds.
ANIM_MS = 220
# Gap between the top of the screen and the island.
TOP_MARGIN = 12
# Timer cadence for the size animation (~60 fps).
ANIM_TICK_MS = 1000 // 60

# Directory the script lives in — style.css sits next to it.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
STYLE_CSS = os.path.join(SCRIPT_DIR, "style.css")
FONT_FAMILY = "IslandFont"


def find_download_font():
    """Return the first .ttf/.otf found anywhere under ~/Downloads."""
    downloads = os.path.expanduser("~/Downloads")
    if not os.path.isdir(downloads):
        return None
    for root, _dirs, files in os.walk(downloads):
        for name in files:
            if name.lower().endswith((".ttf", ".otf")):
                return os.path.join(root, name)
    return None


def build_css():
    """Read style.css and prepend an @font-face rule for the ~/Downloads font."""
    with open(STYLE_CSS, "r", encoding="utf-8") as fh:
        css = fh.read()

    font_path = find_download_font()
    if font_path:
        url = "file://" + urllib.parse.quote(os.path.abspath(font_path))
        css = (
            f'@font-face {{ font-family: "{FONT_FAMILY}"; '
            f'src: url("{url}"); }}\n'
        ) + css
        print(f"[island] font loaded: {font_path}")
    else:
        print(
            "[island] no .ttf/.otf found in ~/Downloads — "
            "falling back to system fonts",
            file=sys.stderr,
        )
    return css


def ease_out_cubic(t):
    """Classic ease-out cubic for a snappy, non-bouncy feel."""
    t -= 1.0
    return 1.0 + t * t * t


class IslandApp(Gtk.Application):
    def __init__(self):
        super().__init__(application_id=APP_ID)
        self.window = None
        self.island = None

        self.expanded = False
        self.animating = False
        self.target = 0.0
        self.progress = 0.0
        self.anim_start = 0.0

        self._cpu_total = None
        self._cpu_idle = None

    # ------------------------------------------------------------- lifecycle

    def do_activate(self):
        if self.window is not None:
            self.window.present()
            return

        provider = Gtk.CssProvider()
        provider.load_from_string(build_css())
        Gtk.StyleContext.add_provider_for_display(
            GdkDisplay(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )

        win = Gtk.Window(application=self)
        win.set_title(NAMESPACE)
        win.set_decorated(False)
        win.set_size_request(COMPACT_W, COMPACT_H)
        win.set_default_size(COMPACT_W, COMPACT_H)
        win.add_css_class("island-window")
        win.set_child(self._build_island())

        # --- layer shell: top edge, horizontally centered, exclusive zone.
        Gtk4LayerShell.init_for_window(win)
        Gtk4LayerShell.set_namespace(win, NAMESPACE)
        Gtk4LayerShell.set_layer(win, Gtk4LayerShell.Layer.TOP)
        # Anchoring only TOP (no left/right) makes the compositor center us.
        Gtk4LayerShell.set_anchor(win, Gtk4LayerShell.Edge.TOP, True)
        Gtk4LayerShell.set_margin(win, Gtk4LayerShell.Edge.TOP, TOP_MARGIN)
        # Reserve screen space for the pill so tiled windows avoid it.
        Gtk4LayerShell.set_exclusive_zone(win, COMPACT_H)
        Gtk4LayerShell.auto_exclusive_zone_enable(win)

        self.window = win
        self._update_size()
        win.present()

        # --- live timers: clock every second, CPU every two seconds.
        GLib.timeout_add_seconds(1, self._update_clock)
        GLib.timeout_add_seconds(2, self._update_cpu)

    # --------------------------------------------------------------- widgets

    def _build_island(self):
        island = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        island.add_css_class("island")
        island.add_css_class("compact")

        # Compact state: a dot + the time, horizontally centered.
        self.compact_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        self.compact_row.set_halign(Gtk.Align.CENTER)
        self.compact_row.set_valign(Gtk.Align.CENTER)

        dot = Gtk.Label(label="●")
        dot.add_css_class("island-dot")

        self.compact_clock = Gtk.Label(label="--:--")
        self.compact_clock.add_css_class("clock-compact")

        self.compact_row.append(dot)
        self.compact_row.append(self.compact_clock)

        # Expanded state: time, date, CPU and a media placeholder.
        self.expanded_panel = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        self.expanded_panel.set_valign(Gtk.Align.FILL)
        self.expanded_panel.set_hexpand(True)
        self.expanded_panel.set_margin_top(6)
        self.expanded_panel.set_margin_bottom(10)
        self.expanded_panel.set_margin_start(16)
        self.expanded_panel.set_margin_end(16)

        top_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        top_row.set_valign(Gtk.Align.CENTER)

        big_dot = Gtk.Label(label="●")
        big_dot.add_css_class("island-dot")

        self.big_clock = Gtk.Label(label="--:--")
        self.big_clock.add_css_class("clock-big")

        date_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        date_box.set_hexpand(True)
        date_box.set_halign(Gtk.Align.END)

        self.date_label = Gtk.Label(label="")
        self.date_label.add_css_class("date-label")
        self.date_label.set_halign(Gtk.Align.END)

        self.media_label = Gtk.Label(label="♪ Ghostlight — Placeholder")
        self.media_label.add_css_class("media-label")
        self.media_label.set_halign(Gtk.Align.END)

        date_box.append(self.date_label)
        date_box.append(self.media_label)

        top_row.append(big_dot)
        top_row.append(self.big_clock)
        top_row.append(date_box)

        separator = Gtk.Box()
        separator.add_css_class("separator")

        cpu_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        cpu_label = Gtk.Label(label="CPU")
        cpu_label.add_css_class("cpu-caption")

        self.cpu_value = Gtk.Label(label="--%")
        self.cpu_value.add_css_class("cpu-value")

        self.cpu_bar = Gtk.ProgressBar()
        self.cpu_bar.set_show_text(False)
        self.cpu_bar.set_hexpand(True)
        self.cpu_bar.set_valign(Gtk.Align.CENTER)
        self.cpu_bar.add_css_class("island-cpu")

        cpu_row.append(cpu_label)
        cpu_row.append(self.cpu_bar)
        cpu_row.append(self.cpu_value)

        self.expanded_panel.append(top_row)
        self.expanded_panel.append(separator)
        self.expanded_panel.append(cpu_row)
        self.expanded_panel.set_visible(False)

        island.append(self.compact_row)
        island.append(self.expanded_panel)

        # Hover expands, leaving collapses; click toggles.
        motion = Gtk.EventControllerMotion.new()
        motion.connect("enter", self._on_enter)
        motion.connect("leave", self._on_leave)
        island.add_controller(motion)

        click = Gtk.GestureClick.new()
        click.connect("pressed", self._on_click)
        island.add_controller(click)

        self.island = island
        return island

    # ------------------------------------------------------------- animation

    def _toggle(self, target):
        self.target = float(target)
        self.anim_start = monotonic()
        if not self.animating:
            self.animating = True
            GLib.timeout_add(ANIM_TICK_MS, self._anim_tick)

    def _anim_tick(self):
        t = min((monotonic() - self.anim_start) / ANIM_MS, 1.0)
        eased = ease_out_cubic(t)
        self.progress = self.target * eased
        self._update_size()

        if t >= 1.0:
            self.progress = self.target
            self.animating = False
            self.expanded = self.target > 0.5
            self._update_size()
            return GLib.SOURCE_REMOVE
        return GLib.SOURCE_CONTINUE

    def _update_size(self):
        w = round(COMPACT_W + (EXPANDED_W - COMPACT_W) * self.progress)
        h = round(COMPACT_H + (EXPANDED_H - COMPACT_H) * self.progress)
        self.window.set_size_request(w, h)
        Gtk4LayerShell.set_exclusive_zone(self.window, h)
        # Keep the pill's border radius proportional to its height.
        self.island.set_css_classes(
            ["island", "expanded" if self.expanded else "compact"]
        )
        self.compact_row.set_visible(not self.expanded)
        self.expanded_panel.set_visible(self.expanded)

    # ---------------------------------------------------------------- events

    def _on_enter(self, _ctrl, _x, _y):
        self._toggle(1.0)

    def _on_leave(self, _ctrl):
        self._toggle(0.0)

    def _on_click(self, _gesture, _n, _x, _y):
        self._toggle(0.0 if self.expanded else 1.0)

    # ----------------------------------------------------------------- data

    def _update_clock(self):
        import datetime

        now = datetime.datetime.now()
        self.compact_clock.set_text(now.strftime("%H:%M"))
        self.big_clock.set_text(now.strftime("%H:%M"))
        self.date_label.set_text(now.strftime("%a, %d %b"))
        return GLib.SOURCE_CONTINUE

    def _cpu_stats(self):
        with open("/proc/stat", "r", encoding="utf-8") as fh:
            nums = [int(v) for v in fh.readline().split()[1:]]
        return sum(nums), nums[3]  # (total, idle)

    def _update_cpu(self):
        total, idle = self._cpu_stats()
        if self._cpu_total is not None:
            dt = total - self._cpu_total
            di = idle - self._cpu_idle
            frac = max(0.0, min(1.0, 1.0 - (di / max(dt, 1))))
            self.cpu_value.set_text(f"{frac * 100:.0f}%")
            self.cpu_bar.set_fraction(frac)
        self._cpu_total, self._cpu_idle = total, idle
        return GLib.SOURCE_CONTINUE


def GdkDisplay():
    """A stable way to grab the default display for the style provider."""
    from gi.repository import Gdk

    return Gdk.Display.get_default()


def main():
    app = IslandApp()
    app.run(None)


if __name__ == "__main__":
    main()
