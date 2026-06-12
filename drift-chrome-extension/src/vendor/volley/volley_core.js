/* @ts-self-types="./volley_core.d.ts" */

/**
 * The control engine that lives in the audio worker.
 */
export class Engine {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Engine.prototype);
        obj.__wbg_ptr = ptr;
        EngineFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_engine_free(ptr, 0);
    }
    /**
     * Samples per analysis frame (20 ms @ 24 kHz = 480).
     * @returns {number}
     */
    frameSize() {
        const ret = wasm.engine_frameSize(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Frames accumulated toward a barge-in (0..barge_speech_frames) — barge "progress".
     * @returns {number}
     */
    getBargeRun() {
        const ret = wasm.engine_getBargeRun(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * The effective threshold/gate used on the most recent frame (includes the echo term while
     * Speaking and the adaptive noise floor when enabled).
     * @returns {number}
     */
    getEffectiveGate() {
        const ret = wasm.engine_getEffectiveGate(this.__wbg_ptr);
        return ret;
    }
    /**
     * RMS energy of the most recent mic frame.
     * @returns {number}
     */
    getLastEnergy() {
        const ret = wasm.engine_getLastEnergy(this.__wbg_ptr);
        return ret;
    }
    /**
     * Why the last non-None action fired: 0=none 1=onset 2=end-silence 3=barge.
     * @returns {number}
     */
    getLastReason() {
        const ret = wasm.engine_getLastReason(this.__wbg_ptr);
        return ret;
    }
    /**
     * Current adaptive noise-floor estimate (0 unless floor_margin > 0).
     * @returns {number}
     */
    getNoiseFloor() {
        const ret = wasm.engine_getNoiseFloor(this.__wbg_ptr);
        return ret;
    }
    /**
     * Construct with default DuplexCascade timing.
     */
    constructor() {
        const ret = wasm.engine_new();
        this.__wbg_ptr = ret >>> 0;
        EngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Feed one mic frame; returns 0=none, 1=user-started, 2=commit, 3=barge-in.
     * @param {Float32Array} frame
     * @returns {number}
     */
    pushMic(frame) {
        const ptr0 = passArrayF32ToWasm0(frame, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.engine_pushMic(this.__wbg_ptr, ptr0, len0);
        return ret >>> 0;
    }
    reset() {
        wasm.engine_reset(this.__wbg_ptr);
    }
    /**
     * Audio bus sample rate (24 000).
     * @returns {number}
     */
    sampleRate() {
        const ret = wasm.engine_sampleRate(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Enable/disable barge-in DURING Thinking. Worker sets this `false` for slow remote brains
     * (e.g. the Claude CLI bridge) so a multi-second think-wait isn't aborted by ambient mic
     * energy; `true` (default) keeps full-duplex for near-instant local brains. Speaking-phase
     * barge-in is unaffected either way.
     * @param {boolean} on
     */
    setBargeInThinking(on) {
        wasm.engine_setBargeInThinking(this.__wbg_ptr, on);
    }
    /**
     * JS reports the RMS of the audio the agent is currently playing (for the
     * echo-aware barge-in gate). Set 0 when silent.
     * @param {number} level
     */
    setOutputLevel(level) {
        wasm.engine_setOutputLevel(this.__wbg_ptr, level);
    }
    /**
     * JS reports the agent's TTS started / stopped playing.
     * @param {boolean} speaking
     */
    setSpeaking(speaking) {
        wasm.engine_setSpeaking(this.__wbg_ptr, speaking);
    }
    /**
     * JS reports the brain/TTS pipeline started after a commit.
     */
    setThinking() {
        wasm.engine_setThinking(this.__wbg_ptr);
    }
    /**
     * Current state: 0=listening, 1=thinking, 2=speaking.
     * @returns {number}
     */
    stateCode() {
        const ret = wasm.engine_stateCode(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Construct with explicit timing (all counts in 20 ms frames).
     * @param {number} vad_threshold
     * @param {number} vad_hang
     * @param {number} min_speech_frames
     * @param {number} end_silence_frames
     * @param {number} barge_speech_frames
     * @param {number} echo_margin
     * @param {number} floor_margin
     * @returns {Engine}
     */
    static withConfig(vad_threshold, vad_hang, min_speech_frames, end_silence_frames, barge_speech_frames, echo_margin, floor_margin) {
        const ret = wasm.engine_withConfig(vad_threshold, vad_hang, min_speech_frames, end_silence_frames, barge_speech_frames, echo_margin, floor_margin);
        return Engine.__wrap(ret);
    }
}
if (Symbol.dispose) Engine.prototype[Symbol.dispose] = Engine.prototype.free;

/**
 * Resample a PCM frame between rates (the worker uses 24 kHz → 16 kHz for Whisper).
 * @param {Float32Array} frame
 * @param {number} in_rate
 * @param {number} out_rate
 * @returns {Float32Array}
 */
export function resample(frame, in_rate, out_rate) {
    const ptr0 = passArrayF32ToWasm0(frame, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.resample(ptr0, len0, in_rate, out_rate);
    var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

/**
 * RMS energy helper (the JS worker uses it to report the agent's output level).
 * @param {Float32Array} frame
 * @returns {number}
 */
export function rmsEnergy(frame) {
    const ptr0 = passArrayF32ToWasm0(frame, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rmsEnergy(ptr0, len0);
    return ret;
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_5549492daedad139: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./volley_core_bg.js": import0,
    };
}

const EngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_engine_free(ptr >>> 0, 1));

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('volley_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
