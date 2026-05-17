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

//╭─────────────────────────────────────╮
//│            ALWAYS NORTH             │
//╰─────────────────────────────────────╯
const rotating = document.getElementById("compass-rotating");

let currentHeading = 0;
let compassStarted = false;

function normalize(angle) {
    return (angle % 360 + 360) % 360;
}

function lerpAngle(a, b, t) {
    let diff = ((b - a + 540) % 360) - 180;
    return normalize(a + diff * t);
}

async function startCompass() {
    if (compassStarted) return;
    compassStarted = true;

    // iOS permission
    if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
        const permission =
            await DeviceOrientationEvent.requestPermission();

        if (permission !== "granted") {
            alert("Orientation permission denied");
            return;
        }
    }

    let targetHeading = 0;

    function updateCompass(event) {
        let heading = null;

        // iOS Safari
        if (typeof event.webkitCompassHeading === "number") {
            heading = event.webkitCompassHeading;
        }

        // Android / modern browsers
        else if (event.absolute === true && event.alpha != null) {
            heading = 360 - event.alpha;
        }

        if (heading == null || isNaN(heading)) {
            return;
        }

        // compensate screen orientation
        const screenAngle =
            screen.orientation?.angle ||
            window.orientation ||
            0;

        heading = normalize(heading - screenAngle);

        targetHeading = heading;
    }

    window.addEventListener(
        "deviceorientationabsolute",
        updateCompass,
        true
    );

    function frame() {
        currentHeading = lerpAngle(
            currentHeading,
            targetHeading,
            0.12
        );

        rotating.style.transform =
            `translate(-50%, -50%) rotate(${-currentHeading}deg)`;

        requestAnimationFrame(frame);
    }

    frame();
}

// ─────────────────────────────────────
const directionColors = [
    { angle: 0, color: [229, 57, 53] }, // N
    { angle: 90, color: [67, 160, 71] }, // E
    { angle: 180, color: [21, 101, 192] }, // S
    { angle: 270, color: [253, 216, 53] }, // W
    { angle: 360, color: [229, 57, 53] }, // wrap to N
];

// ─────────────────────────────────────
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ─────────────────────────────────────
function getCompassColor(angle) {
    angle = (angle + 360) % 360;

    for (let i = 0; i < directionColors.length - 1; i++) {
        const start = directionColors[i];
        const end = directionColors[i + 1];

        if (angle >= start.angle && angle <= end.angle) {
            const t = (angle - start.angle) / (end.angle - start.angle);

            const r = Math.round(lerp(start.color[0], end.color[0], t));
            const g = Math.round(lerp(start.color[1], end.color[1], t));
            const b = Math.round(lerp(start.color[2], end.color[2], t));
            return `rgba(${r}, ${g}, ${b}, 0.32)`;
        }
    }
}

// ─────────────────────────────────────
async function lockLandscape() {
    try {
        // ANDROID
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        }

        // iPHONE / iPAD SAFARI
        else if (document.documentElement.webkitRequestFullscreen) {
            await document.documentElement.webkitRequestFullscreen();
        }

        // Older iOS fallback
        else if (document.documentElement.webkitEnterFullscreen) {
            await document.documentElement.webkitEnterFullscreen();
        }

        // Small delay improves Android reliability
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Orientation lock
        if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock("landscape");
            console.log("Landscape locked");
        } else {
            console.log("Orientation lock API not supported");
        }
    } catch (err) {
      
    }
}

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
        return;
    }

    const { width, height } = getVexSize();

    scaleFactor = computeScaleFactor(width);

    renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, height);

    context = renderer.getContext();
    context.scale(scaleFactor, scaleFactor);

    const staveWidth = width / scaleFactor;

    stave = new Stave(1, 1, staveWidth - 4);
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
function drawArpejo(notes, dyn, time, point) {
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

    const colors = {
        N: "#E53935", // red
        S: "#1565C0", // blue
        W: "#FDD835", // amber/yellow
        E: "#43A047", // green
    };

    if (time > 0) {
        const svg = context.svg;
        if (!svg) return;
        const noteGroups = Array.from(svg.querySelectorAll("g")).filter((g) => g.querySelector(".vf-notehead"));
        for (let i = 0; i < noteGroups.length; i++) {
            setTimeout(() => {
                const head = noteGroups[i].querySelector(".vf-notehead");
                if (!head) return;
                head.setAttribute("fill", colors[point]);
                head.setAttribute("stroke", colors[point]);
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
let noSleepVideo = null;

async function requestWakeLock() {
    // Preferred API (Android Chrome, some modern browsers)
    if ("wakeLock" in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request("screen");

            wakeLock.addEventListener("release", () => {
                console.log("Wake Lock released");
                wakeLock = null;
            });

            console.log("Native wake lock active");
            return;
        } catch (err) {
            console.log("Wake Lock failed:", err);
        }
    }

    // iPhone fallback
    enableIOSWakeLock();
}

// ─────────────────────────────────────
function enableIOSWakeLock() {}

// ─────────────────────────────────────
async function releaseWakeLock() {
    if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
    }

    if (noSleepVideo) {
        noSleepVideo.pause();
        noSleepVideo.remove();
        noSleepVideo = null;
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
    var lastPoint = "N";

    // Receivers
    Pd4Web.onFloatReceived("time", (_, f) => {
        // const minutes = Math.floor(f / 60);
        // const seconds = Math.floor(f % 60);
    });

    Pd4Web.onSymbolReceived("note", (_, s) => {
        drawNote([s], lastDynamic, lastTipo);
    });

    Pd4Web.onListReceived("note", (_, l) => {
        drawArpejo(l, lastDynamic, lastArpejoTime, lastPoint);
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

    Pd4Web.onSymbolReceived("point-to-where", (_, s) => {
        lastPoint = s;
    });

    // GUI
    Pd4Web.onFloatReceived("bar", (_, f) => {
        // const el = document.getElementById("bar");
        // el.style.width = f + "%";
    });

    Pd4Web.onFloatReceived("chordnumber", (_, f) => {});

    Pd4Web.onBangReceived("fim", (r) => {
        context.clear();
    });

    // Init
    document.getElementById("pd4web-init").onclick = async function () {
        try {
            const isApple =
                /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
            const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

            console.log("navigator.userAgent:", navigator.userAgent);
            console.log("navigator.platform:", navigator.platform);
            console.log("navigator.maxTouchPoints:", navigator.maxTouchPoints);

            try {
                if (!isiOS && navigator.platform !== "MacIntel") {
                    document.documentElement.requestFullscreen();
                    lockLandscape();
                } else {
                    console.log("iOS detected, skipping fullscreen");
                }
                
            } catch (err) {
                console.warn("Fullscreen failed:", err);
            }

            try {
                if (screen?.orientation?.lock) {
                    screen.orientation.lock("landscape");
                    console.log("Landscape locked");
                }
            } catch (err) {
                console.warn("Orientation lock failed:", err);
            }

            try {
                requestWakeLock();
            } catch (err) {
                console.warn("Wake lock failed:", err);
            }

            console.log("Initialization complete");
            Pd4Web.init();
            const value = (Math.floor(Math.random() * 5) + 7) * 1000;
            lastArpejoTime = (value - 30) / 2;
            Pd4Web.sendFloat("gesture-time", value);
            document.getElementById("pd4web-init").style.display = "none";
            document.getElementById("title").style.display = "none";
            document.querySelectorAll(".composer-label").forEach((el) => {
                el.style.display = "none";
            });
            vexFlowInit();
            console.log("Score initialized");
            startCompass();
            console.log("Compass started");
            const seed = Math.floor(Math.random() * 2147483647);
            Pd4Web.sendFloat("luaseed", seed);
            Pd4Web.sendFloat("init", 1);
        } catch (err) {
            console.error("Initialization failed:", err);
        }
    };
};

// ─────────────────────────────────────
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
