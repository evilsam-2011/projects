#!/usr/bin/env python3
"""Timebox - standalone Timer, Stopwatch, Pomodoro and Todo app (GTK4 + libadwaita)."""

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Gdk", "4.0")
gi.require_version("Adw", "1")
gi.require_version("Gio", "2.0")

from gi.repository import GLib, Gdk, Gtk, Adw, Gio

import time
import json
import os
import math
import cairo
import shutil
import subprocess

APP_ID = "io.dev.timebox"
ICON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icon", "timebox.png")
DATA_DIR = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share/timebox")
os.makedirs(DATA_DIR, exist_ok=True)

TODO_FILE = os.path.join(DATA_DIR, "timebox-todo.json")
POMO_FILE = os.path.join(DATA_DIR, "timebox-pomo.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "timebox-settings.json")
CHIME_FILE = os.path.join(DATA_DIR, "chime.wav")

SAMPLE_RATE = 44100


def generate_chime():
    """Write a pleasant two-tone chime WAV file."""
    try:
        import struct
        import wave
        dur = 0.9
        n = int(SAMPLE_RATE * dur)
        frames = bytearray()
        for i in range(n):
            t = i / SAMPLE_RATE
            env = min(1.0, t / 0.02) * (1 - t / dur)
            tone = 0.6 * math.sin(2 * math.pi * 880 * t) * (1 if t < 0.3 else 0)
            tone += 0.6 * math.sin(2 * math.pi * 1174.66 * t) * (1 if t >= 0.3 else 0)
            sample = int(32767 * env * tone)
            frames += struct.pack("<h", sample)
        with wave.open(CHIME_FILE, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SAMPLE_RATE)
            w.writeframes(bytes(frames))
        return True
    except Exception:
        return None


for _p in ("paplay", "pw-play", "aplay"):
    _c = shutil.which(_p)
    if _c:
        CHIME_PLAYER = [ _c, CHIME_FILE ]
        break
else:
    CHIME_PLAYER = None

if CHIME_PLAYER and not os.path.exists(CHIME_FILE):
    generate_chime()

CSS = b"""
.digits {
    font-family: "JetBrains Mono", "Fira Code", "DejaVu Sans Mono", monospace;
    font-weight: 300;
    font-size: 40px;
    letter-spacing: 2px;
    color: @theme_fg_color;
}
.hint { color: alpha(@theme_fg_color, 0.55); }
.card {
    background-color: alpha(@theme_bg_color, 0.6);
    border: 1px solid alpha(@theme_fg_color, 0.08);
    border-radius: 18px;
    padding: 24px;
}
.todo-row {
    border-radius: 12px;
    background-color: alpha(@theme_bg_color, 0.35);
}
.float-window {
    background-color: transparent;
}
.float-card {
    background-color: alpha(@theme_bg_color, 0.75);
    border: 1px solid alpha(@theme_fg_color, 0.12);
    border-radius: 22px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    padding: 10px;
}
.digits-float {
    font-family: "JetBrains Mono", "Fira Code", "DejaVu Sans Mono", monospace;
    font-weight: 300;
    font-size: 22px;
    letter-spacing: 1px;
    color: @theme_fg_color;
}
"""


def fmt_time(secs):
    secs = max(0, int(secs))
    h, rem = divmod(secs, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def fmt_ms(secs):
    secs = max(0, secs)
    h, rem = divmod(int(secs), 3600)
    m, r = divmod(rem, 60)
    s = int(r)
    tenth = int((secs * 10) % 10)
    if h:
        return f"{h:02d}:{m:02d}:{s:02d}.{tenth}"
    return f"{m:02d}:{s:02d}.{tenth}"


def store_json(path, data):
    try:
        with open(path, "w") as f:
            json.dump(data, f)
    except Exception:
        pass


def load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


class Ring(Gtk.DrawingArea):
    """Circular progress ring that empties as time runs down."""

    def __init__(self, size=240, width=10):
        super().__init__()
        self._fraction = 1.0
        self._width = width
        self.set_size_request(size, size)
        self.set_draw_func(self._draw, None)

    def set_fraction(self, fraction):
        self._fraction = max(0.0, min(1.0, fraction))
        self.queue_draw()

    def _accent(self, name="accent_bg_color"):
        found, rgba = self.get_style_context().lookup_color(name)
        if found:
            return rgba
        return Gdk.RGBA(0.545, 0.361, 0.965, 1.0)

    def _draw(self, area, cr, width, height, data=None):
        cx, cy = width / 2, height / 2
        radius = min(width, height) / 2 - self._width / 2 - 4

        # background ring
        bg = self._accent("view_fg_color")
        bg.alpha = 0.1
        Gdk.cairo_set_source_rgba(cr, bg)
        cr.set_line_width(self._width)
        cr.arc(cx, cy, radius, 0, 2 * math.pi)
        cr.stroke()

        if self._fraction <= 0:
            return

        # foreground ring - drains as time passes
        fg = self._accent()
        Gdk.cairo_set_source_rgba(cr, fg)
        cr.set_line_width(self._width)
        cr.set_line_cap(cairo.LINE_CAP_ROUND)
        start = -math.pi / 2
        end = start + 2 * math.pi * self._fraction
        cr.arc(cx, cy, radius, start, end)
        cr.stroke()


class FloatingTimerWindow(Gtk.Window):
    """Detached always-on-top ring overlay that follows the Timer panel."""

    SIZE = 170

    def __init__(self, panel):
        super().__init__(title="Timebox Timer")
        self.panel = panel
        self.layer = None
        self._base_top = 0
        self._base_left = 0

        self.set_decorated(False)
        self.set_resizable(False)
        self.set_default_size(self.SIZE, self.SIZE)
        self.add_css_class("float-window")

        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        card.add_css_class("float-card")
        card.set_size_request(self.SIZE, self.SIZE)

        self.ring = Ring(size=130, width=8)
        self.ring.set_halign(Gtk.Align.CENTER)
        self.ring.set_valign(Gtk.Align.CENTER)

        overlay = Gtk.Overlay()
        overlay.set_child(self.ring)
        self.digits = Gtk.Label(label=fmt_time(panel.remaining))
        self.digits.add_css_class("digits-float")
        self.digits.set_halign(Gtk.Align.CENTER)
        self.digits.set_valign(Gtk.Align.CENTER)
        overlay.add_overlay(self.digits)

        close_btn = Gtk.Button.new_from_icon_name("window-close-symbolic")
        close_btn.add_css_class("flat")
        close_btn.set_has_tooltip(True)
        close_btn.set_tooltip_text("Detach back to app")
        close_btn.set_halign(Gtk.Align.END)
        close_btn.set_valign(Gtk.Align.START)
        close_btn.connect("clicked", lambda b: self.close())
        overlay.add_overlay(close_btn)

        card.append(overlay)
        self.set_child(card)

        drag = Gtk.GestureDrag()
        drag.connect("drag-begin", self._drag_begin)
        drag.connect("drag-update", self._drag_update)
        self.add_controller(drag)

        self.connect("close-request", self._on_close)
        self._apply_layer_shell()

    def _apply_layer_shell(self):
        try:
            import gi
            gi.require_version("Gtk4LayerShell", "1.0")
            from gi.repository import Gtk4LayerShell
            Gtk4LayerShell.init_for_window(self)
            Gtk4LayerShell.set_layer(self, Gtk4LayerShell.Layer.TOP)
            Gtk4LayerShell.set_anchor(self, Gtk4LayerShell.Edge.TOP, True)
            Gtk4LayerShell.set_anchor(self, Gtk4LayerShell.Edge.RIGHT, True)
            Gtk4LayerShell.set_margin(self, Gtk4LayerShell.Edge.TOP, 56)
            Gtk4LayerShell.set_margin(self, Gtk4LayerShell.Edge.RIGHT, 24)
            Gtk4LayerShell.set_keyboard_mode(self, Gtk4LayerShell.KeyboardMode.NONE)
            Gtk4LayerShell.set_exclusive_zone(self, 0)
            self.layer = Gtk4LayerShell
        except Exception as e:
            try:
                self.set_transient_for(self.panel.parent.win)
            except Exception:
                pass

    def _on_close(self, *args):
        panel = self.panel
        panel.float_win = None
        if panel.detach_btn:
            panel.detach_btn.set_active(False)
        return False

    def _work_area(self):
        display = Gdk.Display.get_default()
        if display and self.get_surface():
            monitor = display.get_monitor_at_surface(self.get_surface())
            if monitor:
                geo = monitor.get_geometry()
                return geo.width, geo.height
        return 1920, 1080

    def _drag_begin(self, gesture, x, y):
        self._base_top = y
        self._base_left = x

    def _drag_update(self, gesture, dx, dy):
        L = self.layer
        if not L:
            return
        W, H = self._work_area()
        SIZE = self.SIZE
        new_top = self._base_top + dy
        new_left = self._base_left + dx
        new_top = max(0, min(new_top, H - SIZE))
        new_left = max(0, min(new_left, W - SIZE))

        if new_top < (H - SIZE) / 2:
            L.set_anchor(self, L.Edge.TOP, True)
            L.set_anchor(self, L.Edge.BOTTOM, False)
            L.set_margin(self, L.Edge.TOP, int(new_top))
        else:
            L.set_anchor(self, L.Edge.BOTTOM, True)
            L.set_anchor(self, L.Edge.TOP, False)
            L.set_margin(self, L.Edge.BOTTOM, int(H - SIZE - new_top))
        if new_left < (W - SIZE) / 2:
            L.set_anchor(self, L.Edge.LEFT, True)
            L.set_anchor(self, L.Edge.RIGHT, False)
            L.set_margin(self, L.Edge.LEFT, int(new_left))
        else:
            L.set_anchor(self, L.Edge.RIGHT, True)
            L.set_anchor(self, L.Edge.LEFT, False)
            L.set_margin(self, L.Edge.RIGHT, int(W - SIZE - new_left))

    def set_state(self, remaining, total):
        self.ring.set_fraction(remaining / total if total else 0)
        self.digits.set_text(fmt_time(remaining))


class TimerPanel(Gtk.Box):
    def __init__(self, parent):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.parent = parent
        self.total = 900
        self.remaining = 900
        self.running = False
        self.iv = None
        self.end_at = 0
        self.float_win = None

        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18)
        card.add_css_class("card")

        self.ring = Ring(size=250, width=10)
        self.ring.set_margin_top(8)
        self.ring.set_margin_bottom(8)
        self.ring.set_halign(Gtk.Align.CENTER)
        self.ring.set_valign(Gtk.Align.CENTER)

        overlay = Gtk.Overlay()
        overlay.set_child(self.ring)
        self.digits = Gtk.Label(label=fmt_time(self.total))
        self.digits.add_css_class("digits")
        self.digits.set_halign(Gtk.Align.CENTER)
        self.digits.set_valign(Gtk.Align.CENTER)
        overlay.add_overlay(self.digits)
        card.append(overlay)

        self.hint = Gtk.Label(label="Timer ready")
        self.hint.add_css_class("hint")
        self.hint.set_halign(Gtk.Align.CENTER)
        card.append(self.hint)

        presets = Gtk.Box(spacing=8)
        presets.set_halign(Gtk.Align.CENTER)
        self.preset_buttons = []
        for label, secs in (("15", 900), ("30", 1800), ("45", 2700), ("1 hr", 3600)):
            btn = Gtk.ToggleButton(label=label + " min" if label != "1 hr" else label)
            btn.set_active(label == "15")
            btn.connect("toggled", self.on_preset, secs)
            presets.append(btn)
            self.preset_buttons.append(btn)
        card.append(presets)

        spins = Gtk.Box(spacing=8)
        spins.set_halign(Gtk.Align.CENTER)
        self.spin_h = Gtk.SpinButton.new_with_range(0, 23, 1)
        self.spin_m = Gtk.SpinButton.new_with_range(0, 59, 1)
        self.spin_s = Gtk.SpinButton.new_with_range(0, 59, 1)
        self.spin_h.set_value(0)
        self.spin_m.set_value(15)
        self.spin_s.set_value(0)
        for sb in (self.spin_h, self.spin_m, self.spin_s):
            spins.append(sb)
        card.append(spins)

        controls = Gtk.Box(spacing=8)
        controls.set_halign(Gtk.Align.CENTER)
        self.start_btn = Gtk.Button(label="Start")
        self.start_btn.add_css_class("suggested-action")
        self.start_btn.connect("clicked", lambda b: self.toggle())
        reset_btn = Gtk.Button(label="Reset")
        reset_btn.connect("clicked", lambda b: self.reset())
        controls.append(self.start_btn)
        controls.append(reset_btn)

        self.detach_btn = Gtk.ToggleButton()
        self.detach_btn.set_icon_name("window-new-symbolic")
        self.detach_btn.set_has_tooltip(True)
        self.detach_btn.set_tooltip_text("Detach as floating overlay")
        self.detach_btn.connect("toggled", self.toggle_float)
        controls.append(self.detach_btn)
        card.append(controls)

        wrap = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        wrap.set_margin_top(24)
        wrap.set_margin_bottom(24)
        wrap.set_margin_start(24)
        wrap.set_margin_end(24)
        wrap.set_vexpand(True)
        wrap.append(card)
        self.append(wrap)

    def toggle_float(self, btn):
        if btn.get_active():
            if not self.float_win:
                self.float_win = FloatingTimerWindow(self)
                self.float_win.set_application(self.parent)
                self.float_win.present()
                self.float_win.set_state(self.remaining, self.total)
        else:
            if self.float_win:
                win, self.float_win = self.float_win, None
                win.close()

    def duration(self):
        return max(1, int(self.spin_h.get_value()) * 3600
                   + int(self.spin_m.get_value()) * 60
                   + int(self.spin_s.get_value()))

    def on_preset(self, btn, secs):
        if not btn.get_active():
            return
        for other in self.preset_buttons:
            if other is not btn:
                other.set_active(False)
        self.stop()
        self.total = secs
        self.remaining = secs
        self.spin_h.set_value(secs // 3600)
        self.spin_m.set_value((secs % 3600) // 60)
        self.spin_s.set_value(secs % 60)
        self.render()

    def stop(self):
        self.running = False
        if self.iv:
            GLib.source_remove(self.iv)
            self.iv = None
        self.start_btn.set_label("Start")

    def render(self):
        self.digits.set_text(fmt_time(self.remaining))
        if self.total:
            self.ring.set_fraction(self.remaining / self.total)
        if self.float_win:
            self.float_win.set_state(self.remaining, self.total)

    def toggle(self):
        if self.running:
            self.pause()
            return
        if self.remaining <= 0:
            self.remaining = self.total
        self.running = True
        self.end_at = time.monotonic() + self.remaining
        self.iv = GLib.timeout_add(100, self.tick)
        self.start_btn.set_label("Pause")
        self.hint.set_text("Running")

    def pause(self):
        self.running = False
        if self.iv:
            GLib.source_remove(self.iv)
            self.iv = None
        self.remaining = max(0, self.end_at - time.monotonic())
        self.start_btn.set_label("Resume")
        self.render()

    def tick(self):
        self.remaining = max(0, self.end_at - time.monotonic())
        self.render()
        if self.remaining <= 0:
            self.stop()
            self.hint.set_text("Time is up!")
            self.parent.notify("Time is up!")
            self.parent.play_sound()
            return GLib.SOURCE_REMOVE
        return GLib.SOURCE_CONTINUE

    def reset(self):
        self.stop()
        self.total = self.duration()
        self.remaining = self.total
        self.hint.set_text("Timer ready")
        self.render()


class Stopwatch(Gtk.Box):
    def __init__(self, parent):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.parent = parent
        self.elapsed = 0.0
        self.running = False
        self.iv = None
        self.start_at = 0
        self.last_lap = 0
        self.lap_count = 0

        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18)
        card.add_css_class("card")

        self.digits = Gtk.Label(label=fmt_ms(0))
        self.digits.add_css_class("digits")
        self.digits.set_halign(Gtk.Align.CENTER)
        card.append(self.digits)

        controls = Gtk.Box(spacing=8)
        controls.set_halign(Gtk.Align.CENTER)
        self.start_btn = Gtk.Button(label="Start")
        self.start_btn.add_css_class("suggested-action")
        self.start_btn.connect("clicked", lambda b: self.toggle())
        self.lap_btn = Gtk.Button(label="Lap")
        self.lap_btn.set_sensitive(False)
        self.lap_btn.connect("clicked", lambda b: self.lap())
        reset_btn = Gtk.Button(label="Reset")
        reset_btn.connect("clicked", lambda b: self.reset())
        controls.append(self.start_btn)
        controls.append(self.lap_btn)
        controls.append(reset_btn)
        card.append(controls)

        wrap = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        wrap.set_margin_top(24)
        wrap.set_margin_bottom(24)
        wrap.set_margin_start(24)
        wrap.set_margin_end(24)
        wrap.set_vexpand(True)
        wrap.append(card)

        self.laps_list = Gtk.ListBox()
        self.laps_list.set_selection_mode(Gtk.SelectionMode.NONE)
        self.empty = Gtk.Label(label="No laps yet")
        self.empty.add_css_class("hint")
        self.empty.set_halign(Gtk.Align.CENTER)
        self.empty.set_margin_top(16)
        self.empty.set_margin_bottom(16)
        self.laps_list.append(self.empty)

        laps_scroll = Gtk.ScrolledWindow()
        laps_scroll.set_vexpand(True)
        laps_scroll.set_child(self.laps_list)
        wrap.append(laps_scroll)
        self.append(wrap)

    def render(self):
        self.digits.set_text(fmt_ms(self.elapsed))

    def toggle(self):
        if self.running:
            self.pause()
            return
        self.running = True
        self.start_at = time.monotonic() - self.elapsed
        self.iv = GLib.timeout_add(90, self.tick)
        self.start_btn.set_label("Pause")
        self.lap_btn.set_sensitive(True)

    def pause(self):
        self.running = False
        if self.iv:
            GLib.source_remove(self.iv)
            self.iv = None
        self.elapsed = time.monotonic() - self.start_at
        self.start_btn.set_label("Resume")

    def tick(self):
        self.elapsed = time.monotonic() - self.start_at
        self.render()
        return GLib.SOURCE_CONTINUE

    def lap(self):
        now = time.monotonic() - self.start_at
        diff = now - self.last_lap
        self.last_lap = now
        self.lap_count += 1
        if self.laps_list.get_first_child() is self.empty:
            self.laps_list.remove(self.empty)
        row = Gtk.ListBoxRow()
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        box.set_margin_start(12)
        box.set_margin_end(12)
        box.set_margin_top(8)
        box.set_margin_bottom(8)
        num = Gtk.Label(label=f"Lap {self.lap_count}")
        num.set_halign(Gtk.Align.START)
        num.set_hexpand(True)
        dt = Gtk.Label(label=f"+{fmt_ms(diff)}")
        dt.add_css_class("hint")
        time_lbl = Gtk.Label(label=fmt_ms(now))
        time_lbl.set_halign(Gtk.Align.END)
        box.append(num)
        box.append(dt)
        box.append(time_lbl)
        row.set_child(box)
        self.laps_list.prepend(row)

    def reset(self):
        self.running = False
        if self.iv:
            GLib.source_remove(self.iv)
            self.iv = None
        self.elapsed = 0
        self.last_lap = 0
        self.lap_count = 0
        self.start_btn.set_label("Start")
        self.lap_btn.set_sensitive(False)
        while self.laps_list.get_first_child():
            self.laps_list.remove(self.laps_list.get_first_child())
        self.empty = Gtk.Label(label="No laps yet")
        self.empty.add_css_class("hint")
        self.empty.set_halign(Gtk.Align.CENTER)
        self.laps_list.append(self.empty)
        self.render()


class Pomodoro(Gtk.Box):
    PHASES = {"work": "Work", "shortBreak": "Short Break", "longBreak": "Long Break"}

    def __init__(self, parent):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.parent = parent
        data = load_json(POMO_FILE, {})
        self.work = data.get("work", 25)
        self.short = data.get("short", 5)
        self.long = data.get("long", 15)
        self.interval = data.get("interval", 4)
        self.sessions = data.get("sessions", 0)

        self.phase = "work"
        self.total = self.work * 60
        self.remaining = self.total
        self.running = False
        self.iv = None
        self.end_at = 0

        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        card.add_css_class("card")

        phases = Gtk.Box(spacing=8)
        phases.set_halign(Gtk.Align.CENTER)
        self.phase_buttons = {}
        for key, name in self.PHASES.items():
            btn = Gtk.ToggleButton(label=name)
            btn.set_active(key == "work")
            btn.connect("toggled", self.on_phase_btn, key)
            phases.append(btn)
            self.phase_buttons[key] = btn
        card.append(phases)

        self.ring = Ring(size=250, width=10)
        self.ring.set_margin_top(8)
        self.ring.set_margin_bottom(8)
        self.ring.set_halign(Gtk.Align.CENTER)
        self.ring.set_valign(Gtk.Align.CENTER)

        overlay = Gtk.Overlay()
        overlay.set_child(self.ring)
        self.digits = Gtk.Label(label=fmt_time(self.total))
        self.digits.add_css_class("digits")
        self.digits.set_halign(Gtk.Align.CENTER)
        self.digits.set_valign(Gtk.Align.CENTER)
        overlay.add_overlay(self.digits)
        card.append(overlay)

        self.hint = Gtk.Label(label="Ready")
        self.hint.add_css_class("hint")
        self.hint.set_halign(Gtk.Align.CENTER)
        card.append(self.hint)

        self.session_label = Gtk.Label(label="")
        self.session_label.add_css_class("hint")
        self.session_label.set_halign(Gtk.Align.CENTER)
        card.append(self.session_label)

        controls = Gtk.Box(spacing=8)
        controls.set_halign(Gtk.Align.CENTER)
        self.start_btn = Gtk.Button(label="Start")
        self.start_btn.add_css_class("suggested-action")
        self.start_btn.connect("clicked", lambda b: self.toggle())
        reset_btn = Gtk.Button(label="Reset")
        reset_btn.connect("clicked", lambda b: self.reset())
        controls.append(self.start_btn)
        controls.append(reset_btn)
        card.append(controls)

        self.settings_spins = {}
        settings = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        settings.set_halign(Gtk.Align.CENTER)
        for key, lbl_text in (("work", "Work (min)"), ("short", "Short break (min)"),
                              ("long", "Long break (min)"), ("interval", "Interval (sessions)")):
            srow = Gtk.Box(spacing=8)
            lbl = Gtk.Label(label=lbl_text)
            lbl.set_halign(Gtk.Align.START)
            lbl.set_hexpand(True)
            spin = Gtk.SpinButton.new_with_range(1, 120, 1)
            spin.set_value(getattr(self, key))
            spin.connect("value-changed", self.on_setting_change, key)
            srow.append(lbl)
            srow.append(spin)
            settings.append(srow)
            self.settings_spins[key] = spin
        card.append(settings)

        wrap = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        wrap.set_margin_top(24)
        wrap.set_margin_bottom(24)
        wrap.set_margin_start(24)
        wrap.set_margin_end(24)
        wrap.set_vexpand(True)
        wrap.append(card)
        self.append(wrap)

        self.render()

    def phase_length(self):
        return {"work": self.work * 60, "shortBreak": self.short * 60,
                "longBreak": self.long * 60}[self.phase]

    def session_text(self):
        done = self.sessions % self.interval
        filled = "●" * done + "○" * (self.interval - done)
        return f"{self.sessions} sessions   {filled}"

    def on_phase_btn(self, btn, key):
        if not btn.get_active():
            return
        for other, ob in self.phase_buttons.items():
            if other != key:
                ob.set_active(False)
        self.stop()
        self.phase = key
        self.total = self.phase_length()
        self.remaining = self.total
        self.render()

    def on_setting_change(self, spin, key):
        setattr(self, key, max(1, int(spin.get_value())))
        self.save()
        self.stop()
        if key in ("work", "short", "long") and self.phase == key:
            self.total = self.phase_length()
            self.remaining = self.total
        self.render()

    def stop(self):
        self.running = False
        if self.iv:
            GLib.source_remove(self.iv)
            self.iv = None
        self.start_btn.set_label("Start")

    def render(self):
        self.digits.set_text(fmt_time(self.remaining))
        self.session_label.set_text(self.session_text())
        if self.total:
            self.ring.set_fraction(self.remaining / self.total)

    def toggle(self):
        if self.running:
            self.pause()
            return
        if self.remaining <= 0:
            self.remaining = self.total
        self.running = True
        self.end_at = time.monotonic() + self.remaining
        self.iv = GLib.timeout_add(100, self.tick)
        self.start_btn.set_label("Pause")

    def pause(self):
        self.running = False
        if self.iv:
            GLib.source_remove(self.iv)
            self.iv = None
        if self.end_at:
            self.remaining = max(0, self.end_at - time.monotonic())
        self.start_btn.set_label("Resume")
        self.render()

    def tick(self):
        self.remaining = max(0, self.end_at - time.monotonic())
        self.render()
        if self.remaining <= 0:
            self.stop()
            self.advance()
            return GLib.SOURCE_REMOVE
        return GLib.SOURCE_CONTINUE

    def advance(self):
        if self.phase == "work":
            self.sessions += 1
            self.phase = "longBreak" if self.sessions % self.interval == 0 else "shortBreak"
            self.parent.notify("Break time!")
        else:
            self.phase = "work"
            self.parent.notify("Back to work!")
        self.total = self.phase_length()
        self.remaining = self.total
        self.save()
        self.render()
        self.parent.play_sound()

    def reset(self):
        self.stop()
        self.phase = "work"
        self.sessions = 0
        self.total = self.phase_length()
        self.remaining = self.total
        self.save()
        self.render()

    def save(self):
        store_json(POMO_FILE, {"work": self.work, "short": self.short, "long": self.long,
                               "interval": self.interval, "sessions": self.sessions})


class TodoView(Gtk.Box):
    def __init__(self, parent):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.parent = parent
        self.items = load_json(TODO_FILE, [])
        self.filter = "all"

        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14)
        card.add_css_class("card")

        entry_row = Gtk.Box(spacing=8)
        self.entry = Gtk.Entry(placeholder_text="Add a task...")
        self.entry.set_hexpand(True)
        self.entry.connect("activate", lambda e: self.add_item())
        add_btn = Gtk.Button(label="Add")
        add_btn.add_css_class("suggested-action")
        add_btn.connect("clicked", lambda b: self.add_item())
        entry_row.append(self.entry)
        entry_row.append(add_btn)
        card.append(entry_row)

        filters = Gtk.Box(spacing=4)
        filters.set_halign(Gtk.Align.START)
        self.filter_buttons = {}
        for name in ("all", "active", "done"):
            btn = Gtk.ToggleButton(label=name)
            btn.set_active(name == "all")
            btn.connect("toggled", self.on_filter, name)
            filters.append(btn)
            self.filter_buttons[name] = btn
        card.append(filters)

        self.listbox = Gtk.ListBox()
        self.listbox.set_selection_mode(Gtk.SelectionMode.NONE)
        self.listbox.set_vexpand(True)
        card.append(self.listbox)

        self.count_label = Gtk.Label(label="")
        self.count_label.add_css_class("hint")
        self.count_label.set_halign(Gtk.Align.START)
        card.append(self.count_label)

        wrap = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        wrap.set_margin_top(24)
        wrap.set_margin_bottom(24)
        wrap.set_margin_start(24)
        wrap.set_margin_end(24)
        wrap.set_vexpand(True)
        wrap.append(card)
        self.append(wrap)

        self.render()

    def on_filter(self, btn, name):
        if btn.get_active():
            self.filter = name
        for other, ob in self.filter_buttons.items():
            ob.set_active(other == self.filter)
        self.render()

    def add_item(self):
        text = self.entry.get_text().strip()
        if not text:
            return
        self.items.insert(0, {"id": time.time(), "text": text, "done": False})
        self.entry.set_text("")
        self.save()
        self.render()

    def save(self):
        store_json(TODO_FILE, self.items)

    def render(self):
        while self.listbox.get_first_child():
            self.listbox.remove(self.listbox.get_first_child())

        shown = 0
        for item in self.items:
            if self.filter == "active" and item["done"]:
                continue
            if self.filter == "done" and not item["done"]:
                continue
            shown += 1
            row = Gtk.ListBoxRow()
            box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
            box.set_margin_start(10)
            box.set_margin_end(10)
            box.set_margin_top(6)
            box.set_margin_bottom(6)
            check = Gtk.CheckButton()
            check.set_active(item["done"])
            check.connect("toggled", lambda _, it=item: self.toggle_item(it))
            text = Gtk.Label(label=item["text"])
            text.set_halign(Gtk.Align.START)
            text.set_hexpand(True)
            text.set_wrap(True)
            text.set_xalign(0)
            delete = Gtk.Button.new_from_icon_name("user-trash-symbolic")
            delete.add_css_class("flat")
            delete.connect("clicked", lambda _, it=item: self.delete_item(it))
            box.append(check)
            box.append(text)
            box.append(delete)
            row.set_child(box)
            self.listbox.append(row)

        if shown == 0:
            empty = Gtk.Label(label="Nothing here yet")
            empty.add_css_class("hint")
            empty.set_halign(Gtk.Align.CENTER)
            empty.set_margin_top(20)
            empty.set_margin_bottom(20)
            r = Gtk.ListBoxRow()
            r.set_child(empty)
            r.set_selectable(False)
            self.listbox.append(r)

        remaining = sum(1 for i in self.items if not i["done"])
        self.count_label.set_text(f"{remaining} of {len(self.items)} tasks")

    def toggle_item(self, item):
        item["done"] = not item["done"]
        self.save()
        self.render()

    def delete_item(self, item):
        self.items = [i for i in self.items if i["id"] != item["id"]]
        self.save()
        self.render()


class TimeboxApp(Adw.Application):
    def __init__(self):
        super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.FLAGS_NONE)
        self.win = None
        self.toast_overlay = None
        self.sound_on = load_json(SETTINGS_FILE, {}).get("sound", True)

    def do_startup(self):
        Adw.Application.do_startup(self)
        try:
            Adw.StyleManager.get_default().set_color_scheme(Adw.ColorScheme.PREFER_DARK)
        except Exception:
            pass

    def do_activate(self):
        if self.win:
            self.win.present()
            return

        win = Adw.ApplicationWindow(application=self)
        win.set_title("Timebox")
        win.set_default_size(460, 700)

        self.toast_overlay = Adw.ToastOverlay.new()
        win.set_content(self.toast_overlay)

        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        header = Adw.HeaderBar()
        main_box.append(header)

        stack = Gtk.Stack()
        stack.set_vexpand(True)
        stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
        stack.set_transition_duration(180)

        self.timer = TimerPanel(self)
        self.stopwatch = Stopwatch(self)
        self.pomodoro = Pomodoro(self)
        self.todo = TodoView(self)

        stack.add_titled(self.timer, "timer", "Timer")
        stack.add_titled(self.stopwatch, "stopwatch", "Stopwatch")
        stack.add_titled(self.pomodoro, "pomodoro", "Pomodoro")
        stack.add_titled(self.todo, "todo", "Todo")
        main_box.append(stack)

        switcher = Gtk.StackSwitcher()
        switcher.set_stack(stack)
        switcher.set_halign(Gtk.Align.CENTER)
        header.set_title_widget(switcher)

        self.sound_btn = Gtk.ToggleButton()
        self.sound_btn.set_active(self.sound_on)
        self.sound_btn.set_tooltip_text("Sound when finished")
        self.sound_btn.set_icon_name(self._sound_icon())
        self.sound_btn.connect("toggled", self.on_sound_toggle)
        header.pack_end(self.sound_btn)

        self.toast_overlay.set_child(main_box)
        self.win = win
        win.present()

        key_controller = Gtk.EventControllerKey()
        key_controller.connect("key-pressed", self.on_key, stack)
        win.add_controller(key_controller)

        provider = Gtk.CssProvider()
        provider.load_from_data(CSS)
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

    def on_key(self, controller, keyval, keycode, state, stack):
        panel = stack.get_visible_child()
        if keyval == Gdk.KEY_space:
            if isinstance(panel, TimerPanel):
                panel.toggle()
            elif isinstance(panel, Pomodoro):
                panel.toggle()
            elif isinstance(panel, Stopwatch):
                panel.toggle()
            return True
        if keyval in (Gdk.KEY_r, Gdk.KEY_R):
            if isinstance(panel, TimerPanel):
                panel.reset()
            elif isinstance(panel, Pomodoro):
                panel.reset()
            elif isinstance(panel, Stopwatch):
                panel.reset()
            return True
        return False

    def notify(self, message, title="Timebox"):
        if self.toast_overlay:
            self.toast_overlay.add_toast(Adw.Toast.new(message))
        try:
            import subprocess
            subprocess.Popen(
                ["notify-send", "-a", "Timebox", "-i", ICON_PATH, title, message],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

    def _sound_icon(self):
        return "audio-volume-high-symbolic" if self.sound_on else "audio-volume-muted-symbolic"

    def on_sound_toggle(self, btn):
        self.sound_on = btn.get_active()
        btn.set_icon_name(self._sound_icon())
        store_json(SETTINGS_FILE, {"sound": self.sound_on})
        if self.sound_on:
            self.play_sound()
        else:
            self.notify("Sound off")

    def play_sound(self):
        """Play the completion chime, if enabled and a player is available."""
        if not self.sound_on or not CHIME_PLAYER:
            return
        try:
            subprocess.Popen(CHIME_PLAYER, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            display = Gdk.Display.get_default()
            if display:
                display.beep()


def main():
    app = TimeboxApp()
    app.run(None)


if __name__ == "__main__":
    main()
