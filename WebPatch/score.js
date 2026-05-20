import {
    Renderer,
    Stave,
    StaveNote,
    Voice,
    Formatter,
    Accidental,
    TextDynamics,
    Articulation,
    Modifier,
} from "https://cdn.jsdelivr.net/npm/vexflow@5.0.0/+esm";

const mq = window.matchMedia("(orientation: portrait)");
const el = document.getElementById("vexscore");
var renderer = null;
var context = null;
var stave = null;
var scaleFactor = 0;
var BASE_WIDTH = 600;
var isChord30 = false;

//╭─────────────────────────────────────╮
//│            ALWAYS NORTH             │
//╰─────────────────────────────────────╯
// ──────────────────────────────────────────────────────────────
// ALWAYS NORTH COMPASS — works on Android & iOS
// Uses deviceorientation to get absolute heading (true north)
// Smooth lerp animation, pivot from exact center
// ──────────────────────────────────────────────────────────────

const rotatingElement = document.getElementById("compass-rotating");

let currentHeading = 0; // current visual rotation angle
let targetHeading = 0; // real north heading (0° = north)
let compassActive = false;
let animationId = null;

// Normalize angle to [0, 360)
function normalize(angle) {
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return angle;
}

// Linear interpolation for angles (shortest path)
function lerpAngle(start, end, t) {
    const diff = ((end - start + 540) % 360) - 180;
    return normalize(start + diff * t);
}

function getAbsoluteNorth(event) {
    // --------------------------------------------------
    // Platform detection
    // --------------------------------------------------

    const ua = navigator.userAgent || navigator.vendor || window.opera;

    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const isAndroid = /Android/.test(ua);

    // --------------------------------------------------
    // Screen orientation compensation
    // --------------------------------------------------
    // portrait            =>   0
    // landscape left      =>  90
    // landscape right     => -90 / 270
    // upside down         => 180

    let screenAngle = 0;

    // Modern API
    if (screen.orientation && typeof screen.orientation.angle === "number") {
        screenAngle = screen.orientation.angle;
    }

    // iOS fallback
    else if (typeof window.orientation === "number") {
        screenAngle = window.orientation;
    }

    screenAngle = normalize(screenAngle);

    // --------------------------------------------------
    // iOS
    // --------------------------------------------------
    // webkitCompassHeading already references TRUE NORTH
    // but DOES NOT compensate for screen orientation
    // so we compensate manually

    if (isIOS && typeof event.webkitCompassHeading === "number") {
        let heading = event.webkitCompassHeading;

        if (isNaN(heading)) {
            return null;
        }

        // compensate screen rotation
        heading += screenAngle;

        return normalize(heading);
    }

    // --------------------------------------------------
    // Android
    // --------------------------------------------------
    // alpha:
    // 0 = device facing north
    // rotation direction opposite visual compass
    //
    // Need:
    // 1. invert alpha
    // 2. compensate screen orientation

    if (isAndroid && event.alpha != null) {
        let heading = event.alpha;

        if (isNaN(heading)) {
            return null;
        }

        heading = 360 - heading;

        // compensate screen orientation
        heading += screenAngle;

        return normalize(heading);
    }

    // --------------------------------------------------
    // Generic fallback
    // --------------------------------------------------
    if (event.absolute === true && event.alpha != null) {
        let heading = event.alpha;

        if (isNaN(heading)) {
            return null;
        }

        heading = 360 - heading;

        heading += screenAngle;

        return normalize(heading);
    }

    return null;
}

// Orientation event handler
function onDeviceOrientation(event) {
    if (!compassActive) return;

    const heading = getAbsoluteNorth(event);
    if (heading !== null && !isNaN(heading)) {
        targetHeading = heading;
    }
}

// Animation loop — smooth rotation from center
function animateCompass() {
    if (!rotatingElement) return;

    // Smooth interpolation (0.12 gives natural following)
    currentHeading = lerpAngle(currentHeading, targetHeading, 0.12);

    // Rotate the group by -currentHeading so North aligns with geographic north
    rotatingElement.style.transform = `rotate(${-currentHeading}deg)`;

    animationId = requestAnimationFrame(animateCompass);
}

// Request permission (iOS required) and start compass
async function startCompass() {
    // iOS 13+ requires explicit permission request from user gesture
    if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
        try {
            const permissionState = await DeviceOrientationEvent.requestPermission();
            if (permissionState === "granted") {
                startListening();
            } else {
                console.warn("Compass permission denied");
                // fallback: show on screen but no alert to keep clean
            }
        } catch (err) {
            console.error("Permission request error:", err);
        }
    } else {
        // Android & desktop — start immediately
        startListening();
    }
}

function startListening() {
    if (compassActive) return;
    compassActive = true;

    // Prefer deviceorientationabsolute (more accurate on Android)
    if ("ondeviceorientationabsolute" in window) {
        window.addEventListener("deviceorientationabsolute", onDeviceOrientation, true);
    } else {
        window.addEventListener("deviceorientation", onDeviceOrientation, true);
    }

    // Start animation loop
    if (animationId === null) {
        animateCompass();
    }
}

// Block update of website
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
    } catch (err) {}
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

    // ADD FERMATA HERE
    if (true) {
        const lastNote = staveNotes[staveNotes.length - 1];

        const line = lastNote.getKeyProps()[0].line;

        const isHigh = line >= 4;

        const fermata = new Articulation(isHigh ? "a@u" : "a@a");

        // 3 = above
        // 4 = below
        fermata.setPosition(isHigh ? 4 : 3);

        lastNote.addModifier(fermata, 0);
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
        W: "#a89023", // amber/yellow
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

    const score = document.getElementById("vexscore");
    const color = colors[point];
    score.style.boxShadow = `
    0 0 14px ${color}90,
    0 8px 24px rgba(0,0,0,0.32)
`;
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
    Pd4Web.onFloatReceived("bar-width", (_, f) => {
        const el = document.getElementById("bar");
        el.style.width = f * 100 + "%";
    });

    Pd4Web.onFloatReceived("chordnumber", (_, f) => {
        if (f === 30) {
            isChord30 = true;
        } else {
            isChord30 = false;
        }

        document.getElementById("chordnumber").textContent = f;
    });

    Pd4Web.onBangReceived("fim", (r) => {
        context.clear();
    });

    // Init
    document.getElementById("pd4web-init").onclick = async function () {
        if (isPortrait()) {
            alert("Por Favor, use modo paisagem para a obra");
            return;
        }

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
