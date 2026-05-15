import {
    Renderer,
    Stave,
    StaveNote,
    Voice,
    Formatter,
    Accidental,
    TextDynamics,
} from "https://cdn.jsdelivr.net/npm/vexflow@5.0.0/+esm";

const mq = window.matchMedia("(orientation: portrait)");
const el = document.getElementById("vexscore");
var renderer = null;
var context = null;
var stave = null;
var scaleFactor = 0;
var BASE_WIDTH = 600;

// ─────────────────────────────────────
function isPortrait() {
    return window.innerHeight > window.innerWidth;
}

// ─────────────────────────────────────
function computeScaleFactor(width) {
    return Math.min(2, Math.max(0.5, width / BASE_WIDTH));
}

// ─────────────────────────────────────
function getVexSize() {
    const rect = el.getBoundingClientRect();
    return {
        width: rect.width,
        height: rect.height,
    };
}

// ─────────────────────────────────────
function clearSVG() {
    if (!el) return;

    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}

// ─────────────────────────────────────
function vexFlowInit() {
    clearSVG();

    if (isPortrait()) {
        alert("Por Favor, use modo paisagem para a obra");
    }

    const { width, height } = getVexSize();

    scaleFactor = computeScaleFactor(width);

    renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, height);

    context = renderer.getContext();
    context.scale(scaleFactor, scaleFactor);

    const staveWidth = width / scaleFactor;
    const staveHeight = height / scaleFactor;

    stave = new Stave(1, 1, staveWidth - 2);
    stave.setContext(context);

    stave.addClef("treble");
    stave.draw();
}

//╭─────────────────────────────────────╮
//│            Draw Commands            │
//╰─────────────────────────────────────╯
function drawLonga(notes, dyn) {
    const match = notes[0].match(/([A-G])([b#]*)(\d+)/);
    const [, pitch, accidental, octave] = match;
    const key = `${pitch.toLowerCase()}${accidental}/${octave}`;
    const staveNote = new StaveNote({
        keys: [key],
        duration: "w",
        auto_stem: true,
    });

    if (accidental) {
        staveNote.addModifier(new Accidental(accidental), 0);
    }

    const voice = new Voice({
        num_beats: 4,
        beat_value: 4,
    });

    voice.addTickables([staveNote]);

    new Formatter().joinVoices([voice]).formatToStave([voice], stave);
    context.clear();
    stave.setContext(context).draw();
    voice.draw(context, stave);

    const dynamic = new TextDynamics({
        text: dyn,
        duration: "w",
        line: 10,
    });

    dynamic.setContext(context);
    dynamic.setStave(stave);
    dynamic.setTickContext(staveNote.getTickContext());
    dynamic.setXShift(-4);
    dynamic.preFormat();
    dynamic.draw();
}

// ─────────────────────────────────────
function drawArpejo(notes, dyn, time) {
    if (notes.length == 0) {
        return;
    }

    const staveNotes = [];
    for (const n of notes) {
        const match = n.match(/([A-G])([b#]*)(\d+)/);
        if (!match) continue;
        const [, pitch, accidental, octave] = match;
        const key = `${pitch.toLowerCase()}${accidental}/${octave}`;
        const note = new StaveNote({
            keys: [key],
            duration: "q",
        });
        if (accidental) {
            note.addModifier(new Accidental(accidental), 0);
        } else {
            note.addModifier(new Accidental("n"), 0);
        }
        staveNotes.push(note);
    }

    const voice = new Voice({
        num_beats: staveNotes.length,
        beat_value: 4,
    });

    voice.setStrict(false);
    voice.addTickables(staveNotes);
    new Formatter().joinVoices([voice]).formatToStave([voice], stave);

    // remove stem
    for (let i = 0; i < staveNotes.length; i++) {
        const note = staveNotes[i];
        note.stem.hide = true;
    }

    context.clear();
    stave.setContext(context).draw();
    voice.draw(context, stave);

    if (dyn) {
        const dynamic = new TextDynamics({
            text: dyn,
            duration: "q",
            line: 10,
        });

        dynamic.setContext(context);
        dynamic.setStave(stave);
        dynamic.setTickContext(staveNotes[0].getTickContext());

        dynamic.setXShift(-4);

        dynamic.preFormat();
        dynamic.draw();
    }

    if (time > 0) {
        const svg = context.svg;
        if (!svg) return;

        const noteGroups = Array.from(svg.querySelectorAll("g")).filter((g) => g.querySelector(".vf-notehead"));

        for (let i = 0; i < noteGroups.length; i++) {
            setTimeout(() => {
                const head = noteGroups[i].querySelector(".vf-notehead");
                if (!head) return;

                head.setAttribute("fill", "red");
                head.setAttribute("stroke", "red");
            }, time * i);
        }
    }
}

// ─────────────────────────────────────
function drawTrilo(notes, dyn, tipo) {}

// ─────────────────────────────────────
function drawNote(notes, dyn, tipo) {
    if (tipo == "longa") {
        drawLonga(notes, dyn);
    }
}

// ─────────────────────────────────────
let wakeLock = null;

async function requestWakeLock() {
    try {
        if (!("wakeLock" in navigator)) return;
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => {
            console.log("Wake Lock released");
            wakeLock = null;
        });
    } catch (err) {
        console.log("Wake Lock failed:", err);
    }
}

// ─────────────────────────────────────
function enterFullscreen() {
    const el = document.documentElement;

    if (el.requestFullscreen) {
        el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
        // Safari
        el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
    }
}

//╭─────────────────────────────────────╮
//│                Init                 │
//╰─────────────────────────────────────╯
window.onload = async function () {
    vexFlowInit();
    while (window.Pd4Web == null) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    var lastDynamic = "pp";
    var lastTipo = "Longa";
    var lastArpejoTime = null;

    // Receivers
    Pd4Web.onFloatReceived("time", (_, f) => {
        const minutes = Math.floor(f / 60);
        const seconds = Math.floor(f % 60);
        document.getElementById("clock").textContent =
            `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    });

    Pd4Web.onSymbolReceived("note", (_, s) => {
        drawNote([s], lastDynamic, lastTipo);
    });

    Pd4Web.onListReceived("note", (_, l) => {
        drawArpejo(l, lastDynamic, lastArpejoTime);
    });

    Pd4Web.onSymbolReceived("dynamic", (_, s) => {
        lastDynamic = s;
    });

    Pd4Web.onFloatReceived("arpejotime", (_, f) => {
        lastArpejoTime = f;
    });

    Pd4Web.onSymbolReceived("tipo", (_, s) => {
        lastTipo = s;
    });

    // GUI
    Pd4Web.onFloatReceived("bar", (_, f) => {
        const el = document.getElementById("bar");
        el.style.width = f + "%";
    });

    Pd4Web.onFloatReceived("chordnumber", (_, f) => {
        const el = document.querySelector(".progress-text");
        if (!el) return;
        el.innerText = `Momento ${f}`;
    });

    // Init
    document.getElementById("pd4web-init").onclick = async function () {
        Pd4Web.init();

        var value = (Math.floor(Math.random() * 5) + 7) * 1000;
        lastArpejoTime = (value - 30) / 2;
        Pd4Web.sendFloat("gesture-time", value);

        try {
            enterFullscreen();
            await requestWakeLock();
        } catch (e) {
            console.error("WakeLock failed:", e);
        }

        const btn = document.getElementById("pd4web-init");
        btn.style.display = "none";
        const title = document.getElementById("title");
        title.style.display = "none";
        vexFlowInit();
        const seed = Math.floor(Math.random() * 2147483647);
        Pd4Web.sendFloat("luaseed", seed);
        Pd4Web.sendFloat("init", 1);
    };
};

function handleOrientationChange(e) {
    if (e.matches) {
        console.warn("Portrait mode detected");
    } else {
        console.log("Landscape mode detected");
    }
    window.location.reload();
}

// modern API
mq.addEventListener("change", handleOrientationChange);

window.drawArpejo = drawArpejo;
