import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { VoiceState } from '../core/voiceController';

// A living "entity" orb that visualizes the assistant's voice state on a WebGL
// shader: a breathing sphere of volumetric plasma adrift in a parallax starfield,
// with an iridescent rim, gaze-following light, and memory-echo ripples on speech.
//
// It is a PURE VISUALIZER: it owns no audio. `mode` and a per-frame `levelRef`
// (0..1 energy) are driven by the live VoiceController (mic loudness while
// listening, agent playback while speaking), so the orb breathes with the real
// conversation. Falls back to a CSS pulse if WebGL is unavailable, and parks its
// render loop when off-screen/hidden.

const NB = 64;
const STATE: Record<VoiceState, { glow: [number, number, number]; coh: number; think: number; lab: string }> = {
  idle: { glow: [255, 150, 60], coh: 0.1, think: 0, lab: 'ready' },
  listening: { glow: [255, 185, 95], coh: 0.45, think: 0, lab: 'listening' },
  thinking: { glow: [185, 130, 255], coh: 0.3, think: 1, lab: 'thinking' },
  speaking: { glow: [255, 205, 120], coh: 0.85, think: 0, lab: 'speaking' },
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos,0.0,1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime, uEnergy, uThink, uCoh, uSize;
uniform vec3  uGlow;            // 0..255
uniform vec2  uPointer;
uniform float uEcho[5];
uniform sampler2D uSpec;        // 64x1 luminance, REPEAT, LINEAR

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float hash13(vec3 p){ p=fract(p*0.1031); p+=dot(p, p.yzx+33.33); return fract((p.x+p.y)*p.z); }
float vnoise3(vec3 p){
  vec3 i=floor(p), f=fract(p), u=f*f*(3.0-2.0*f);
  float a=hash13(i+vec3(0,0,0)), b=hash13(i+vec3(1,0,0));
  float c=hash13(i+vec3(0,1,0)), d=hash13(i+vec3(1,1,0));
  float e=hash13(i+vec3(0,0,1)), g=hash13(i+vec3(1,0,1));
  float h=hash13(i+vec3(0,1,1)), k=hash13(i+vec3(1,1,1));
  float x1=mix(a,b,u.x), x2=mix(c,d,u.x), x3=mix(e,g,u.x), x4=mix(h,k,u.x);
  return mix(mix(x1,x2,u.y), mix(x3,x4,u.y), u.z);
}
float fbm3(vec3 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise3(p); p=p*2.03+vec3(1.3,5.1,2.7); a*=0.5; } return s; }
vec3 pal(float t){ return 0.5 + 0.5*cos(6.2831853*(vec3(1.0,1.0,1.0)*t + vec3(0.0,0.33,0.66))); }
vec3 ramp(float h){
  h=clamp(h,0.0,1.0);
  vec3 c=mix(vec3(0.30,0.03,0.02), vec3(1.0,0.25,0.06), smoothstep(0.0,0.30,h));
  c=mix(c, vec3(1.0,0.55,0.12), smoothstep(0.30,0.55,h));
  c=mix(c, vec3(1.0,0.82,0.40), smoothstep(0.55,0.80,h));
  c=mix(c, vec3(1.0,0.97,0.88), smoothstep(0.80,1.0,h));
  return c;
}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
float starL(vec2 p, float d, float tw){
  vec2 g=floor(p), f=fract(p); float hh=hash(g);
  return step(1.0-d, hh) * smoothstep(0.14,0.0,length(f-0.5)) * (0.5+0.5*sin(uTime*tw+hh*30.0));
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  float en = uEnergy;
  float aN = ang/6.2831853 + 0.5;
  float sp = texture2D(uSpec, vec2(aN,0.5)).r;
  vec3 G = uGlow/255.0;

  // ── void + parallax starfield ──
  vec2 par = uPointer*0.05;
  vec3 col = mix(vec3(0.012,0.014,0.032), vec3(0.0,0.0,0.006), smoothstep(0.0,1.3,r));
  col += vec3(0.6,0.7,1.0)*starL((uv+par)*14.0, 0.04, 1.5)*0.5;
  col += vec3(1.0,0.9,0.8)*starL((uv+par*2.2)*8.0, 0.03, 0.8)*0.7;

  // ── breathing sphere radius (heaves on speech) ──
  float RR = 0.32 * (1.0 + 0.018*sin(uTime*0.7) + uSize*0.12 + uSize*0.045*sin(uTime*1.25));

  // outer glow + contained corona
  float outG = exp(-max(r-RR,0.0)*7.0) * step(RR-0.002, r);
  col += G * outG * (0.22 + en*0.6);
  float fl = 0.02 + sp*(0.10 + en*0.12);
  float halo = exp(-max(r-RR,0.0)/(fl*0.5+0.01)) * step(RR, r);
  col += G * halo * (0.35 + sp*1.4);

  // memory echoes ripple out from the rim
  for(int k=0;k<5;k++){
    float age=uEcho[k];
    if(age>=0.0){
      float er=RR + age*0.20;
      col += G * exp(-pow((r-er)/0.022,2.0)) * exp(-age*0.5) * 0.5;
    }
  }

  // ── the orb ──
  float inside = RR*RR - r*r;
  float z = sqrt(max(inside, 0.0));
  vec3 N = vec3(uv, z)/RR;
  vec3 V = vec3(0.0,0.0,1.0);
  vec3 L = normalize(vec3(uPointer*0.7 + vec2(-0.25,0.35), 0.95));  // light follows your gaze
  float diff = clamp(dot(N,L),0.0,1.0);
  float fres = pow(1.0 - clamp(dot(N,V),0.0,1.0), 3.0);
  vec3 Hh = normalize(L+V);
  float spec = pow(clamp(dot(N,Hh),0.0,1.0), 42.0);
  float specBloom = pow(clamp(dot(N,Hh),0.0,1.0), 8.0) * 0.22;   // soft glossy halo around glint
  float depth = z/RR;                                            // 1 at center, 0 at limb

  // volumetric plasma (domain-warped 3D fbm — smooth, no facets)
  vec3 fp = vec3(uv*2.2, z*2.2) + vec3(0.0,0.0,uTime*0.15);
  float w1 = fbm3(fp + uTime*0.1 + uThink*vec3(sin(uTime),cos(uTime),0.0));
  float plasma = fbm3(fp + vec3(w1)*(1.0 + uSize*1.2));
  float rings = 0.5 + 0.5*sin((z/RR)*14.0 - uTime*2.4);   // ordered pulse when coherent
  plasma = mix(plasma, rings, uCoh*0.4);

  // deeper counter-drifting layer for interior parallax
  float core = fbm3(vec3(uv*3.2, z*1.6) - vec3(0.0,0.0,uTime*0.11));

  float heat = plasma*0.8 + depth*0.35 + en*0.45;
  vec3 inner = ramp(heat);
  inner += ramp(core) * (1.0 - depth) * 0.18;                    // limb-side inner glow, opposite motion
  vec3 sheen = pal(fres*1.1 + plasma*0.25 + uTime*0.03);          // thin-film rim iridescence

  float back = pow(1.0 - clamp(dot(N,V),0.0,1.0), 2.0) * clamp(-dot(N,L),0.0,1.0); // backlit limb

  vec3 orb = inner*(0.45 + diff*0.85)
           + sheen*fres*1.1
           + vec3(1.0,0.96,0.88)*(spec*1.6 + specBloom)
           + vec3(0.30,0.48,0.85)*back*0.55                       // cool glass backlight
           + vec3(1.0,0.78,0.45)*exp(-r*r/(RR*RR)*3.0)*(0.3 + en*0.6);   // glowing heart
  orb += vec3(1.0,0.96,0.88)*smoothstep(RR-0.02, RR-0.003, r)*fres*(0.4+en*0.4); // crisp rim edge
  orb *= mix(vec3(1.0), G, 0.22);

  float aa = 1.5/uRes.y;                                          // resolution-independent edge
  float mask = smoothstep(RR, RR - aa - 0.002, r);
  col = mix(col, orb, mask);

  // presence well
  float dP = length(uv-uPointer);
  col += G * exp(-dP*dP*16.0) * 0.18 * (0.4 + en);

  col *= 1.0 - 0.22*smoothstep(0.55, 1.3, r);   // gentle vignette
  col = aces(col*(1.0 + en*0.2));
  col = pow(col, vec3(1.0/2.2));
  col += (hash(gl_FragCoord.xy) - 0.5)/255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

const mq = (q: string) => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches;

export function VoiceOrb({
  mode,
  levelRef,
  height = 240,
}: {
  mode: VoiceState;
  /** Per-frame 0..1 energy from the VoiceController (written, not setState'd). */
  levelRef?: MutableRefObject<number>;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const specRef = useRef(new Float32Array(NB));
  const specBytes = useRef(new Uint8Array(NB));
  const echoesRef = useRef<number[]>([]); // speech-onset timestamps (seconds)
  const echoAges = useRef(new Float32Array(5));
  const sig = useRef({
    mode: mode as VoiceState,
    e: 0,
    v: 0,
    target: 0,
    size: 0,
    glow: [255, 150, 60] as [number, number, number],
    coh: 0.1,
    think: 0,
    ptr: [0, 0] as [number, number],
    ptrT: [0, 0] as [number, number],
    lastMove: -99,
    lastT: 0,
    running: true,
    inView: true,
  });
  const [failed, setFailed] = useState(false);

  const reduce = mq('(prefers-reduced-motion: reduce)');

  // Mirror the latest mode into the render loop's ref (no re-init), and ripple a
  // memory-echo out from the rim each time the entity begins to speak.
  useEffect(() => {
    sig.current.mode = mode;
    if (mode === 'speaking') {
      const ec = echoesRef.current;
      if (ec.length >= 5) ec.shift();
      ec.push(performance.now() / 1000);
    }
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let gl: WebGLRenderingContext;
    let prog: WebGLProgram | null = null;
    let specTex: WebGLTexture | null = null;
    const U: Record<string, WebGLUniformLocation | null> = {};
    let W = 0;
    let H = 0;

    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };

    const build = (): boolean => {
      const ctx =
        (canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false }) as WebGLRenderingContext | null) ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (!ctx) {
        setFailed(true);
        return false;
      }
      gl = ctx;
      glRef.current = gl;
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) {
        setFailed(true);
        return false;
      }
      prog = gl.createProgram();
      gl.attachShader(prog!, vs);
      gl.attachShader(prog!, fs);
      gl.linkProgram(prog!);
      if (!gl.getProgramParameter(prog!, gl.LINK_STATUS)) {
        setFailed(true);
        return false;
      }
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog!, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      for (const n of ['uRes', 'uTime', 'uEnergy', 'uThink', 'uCoh', 'uSize', 'uGlow', 'uPointer', 'uEcho', 'uSpec'])
        U[n] = gl.getUniformLocation(prog!, n);

      specTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, specTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(U.uSpec, 0);
      return true;
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width * dpr));
      H = Math.max(1, Math.round(r.height * dpr));
      canvas.width = W;
      canvas.height = H;
      if (glRef.current) glRef.current.viewport(0, 0, W, H);
    };

    if (!build()) return;
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Gaze tracking — the orb's light and parallax follow the pointer.
    const onMove = (ev: PointerEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const touch = (ev as TouchEvent).touches?.[0];
      const cx = (touch ? touch.clientX : (ev as PointerEvent).clientX) - rect.left;
      const cy = (touch ? touch.clientY : (ev as PointerEvent).clientY) - rect.top;
      sig.current.ptrT = [(cx / rect.width - 0.5) * (rect.width / rect.height), -(cy / rect.height - 0.5)];
      sig.current.lastMove = performance.now() / 1000;
    };
    const onLeave = () => {
      sig.current.lastMove = -99;
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('touchmove', onMove, { passive: true });

    let simSyl = 0;
    let simGate = 0;
    const draw = (tms: number) => {
      const s = sig.current;
      const t = tms / 1000;
      const dt = s.lastT ? Math.min(0.05, t - s.lastT) : 0.016;
      s.lastT = t;

      const spec = specRef.current;
      const setSpec = (fn: (i: number) => number) => {
        const kk = 1 - Math.exp(-dt * 11);
        for (let i = 0; i < NB; i++) spec[i] += (Math.max(0, fn(i)) - spec[i]) * kk;
      };
      const breath = 0.5 + 0.5 * Math.sin(t * 0.95);
      const lvl = Math.max(0, Math.min(1, levelRef?.current ?? 0));

      if (s.mode === 'listening') {
        // Real mic loudness drives the corona; a touch of motion keeps it alive.
        simGate = Math.max(simGate * Math.exp(-dt * 1.2), lvl);
        s.target = simGate;
        setSpec((i) => s.target * (0.4 + 0.6 * Math.abs(Math.sin(t * 6 + i))) * (1 - (i / NB) * 0.4));
      } else if (s.mode === 'speaking') {
        // Real playback loudness + a faint syllabic shimmer.
        simSyl = Math.max(0, simSyl - dt * 2.7);
        if (simSyl <= 0 && lvl > 0.12 && Math.random() < 0.16) simSyl = 0.3 + Math.random() * 0.2;
        s.target = Math.min(1, 0.18 + lvl * 0.85 + simSyl * 0.3);
        setSpec((i) => (s.target * (0.5 + 0.5 * Math.sin(t * (7 + i * 0.4) + i)) + simSyl * 0.4) * (1 - (i / NB) * 0.35));
      } else if (s.mode === 'thinking') {
        s.target = 0.26 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2.4));
        setSpec((i) => 0.18 * (0.5 + 0.5 * Math.sin(t * 1.6 + i * 0.5)));
      } else {
        s.target = 0.12 + breath * 0.08;
        setSpec((i) => 0.08 * (0.5 + 0.5 * Math.sin(t * 1.1 + i * 0.4)));
      }

      // critically-damped spring toward target
      const omega = reduce ? 8 : 14;
      s.v += (omega * omega * (s.target - s.e) - 2 * omega * s.v) * dt;
      s.e += s.v * dt;
      const e = Math.max(0, s.e);
      s.size += (e - s.size) * (1 - Math.exp(-dt * 3.2)); // slow swell, immune to syllable spikes

      // pointer presence — when idle, the orb drifts its gaze on its own
      const since = t - s.lastMove;
      if (since > 2.0) s.ptrT = [0.28 * Math.sin(t * 0.3), 0.18 * Math.sin(t * 0.23 + 1.0)];
      const presence = Math.exp(-Math.max(0, since) * 1.2);

      const cfg = STATE[s.mode] || STATE.idle;
      const ck = 1 - Math.exp(-dt * 5);
      for (let i = 0; i < 3; i++) s.glow[i] = lerp(s.glow[i], cfg.glow[i], ck);
      s.coh = lerp(s.coh, Math.min(0.95, cfg.coh + presence * 0.12), ck);
      s.think = lerp(s.think, cfg.think, ck);
      for (let i = 0; i < 2; i++) s.ptr[i] = lerp(s.ptr[i], s.ptrT[i], 1 - Math.exp(-dt * 7));

      // age out memory echoes and pack the live ones for the shader
      const echoes = echoesRef.current;
      while (echoes.length && t - echoes[0] > 9) echoes.shift();
      const ages = echoAges.current;
      for (let i = 0; i < 5; i++) ages[i] = i < echoes.length ? t - echoes[i] : -1;

      for (let i = 0; i < NB; i++) specBytes.current[i] = Math.min(255, spec[i] * 255) | 0;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, specTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, NB, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, specBytes.current);

      gl.uniform2f(U.uRes, W, H);
      gl.uniform1f(U.uTime, t);
      gl.uniform1f(U.uEnergy, e);
      gl.uniform1f(U.uSize, s.size);
      gl.uniform1f(U.uThink, s.think);
      gl.uniform1f(U.uCoh, s.coh);
      gl.uniform3f(U.uGlow, s.glow[0], s.glow[1], s.glow[2]);
      gl.uniform2f(U.uPointer, s.ptr[0], s.ptr[1]);
      gl.uniform1fv(U.uEcho, ages);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (s.running && s.inView) rafRef.current = requestAnimationFrame(draw);
    };

    const start = () => {
      const s = sig.current;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (s.running && s.inView && glRef.current) {
        s.lastT = 0;
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    const onVis = () => {
      sig.current.running = !document.hidden;
      start();
    };
    const onLost = (ev: Event) => {
      ev.preventDefault();
      cancelAnimationFrame(rafRef.current);
    };
    const onRestored = () => {
      if (build()) {
        resize();
        start();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    const io = new IntersectionObserver(
      ([en]) => {
        sig.current.inView = en.isIntersecting;
        start();
      },
      { threshold: 0.05 },
    );
    io.observe(canvas);
    start();

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('touchmove', onMove);
      io.disconnect();
      ro.disconnect();
    };
  }, [reduce, levelRef]);

  const cfg = STATE[mode];
  const glowCss = `rgb(${cfg.glow.join(',')})`;

  return (
    <div className="vorb">
      {failed ? (
        <div className={`vorb-fallback ${mode}`} style={{ height }} role="img" aria-label={`Voice assistant, ${cfg.lab}`}>
          <span className="vorb-fallback-core" style={{ background: glowCss, boxShadow: `0 0 40px ${glowCss}` }} />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="vorb-canvas"
          style={{ height }}
          role="img"
          aria-label={`Voice assistant orb, currently ${cfg.lab}`}
        />
      )}
      <p className="sr-only" aria-live="polite">
        {cfg.lab}
      </p>
      <div className="vorb-meta" aria-hidden="true">
        <span className="vorb-state" style={{ color: glowCss, textShadow: `0 0 14px ${glowCss}` }}>
          <span className="vorb-dot" style={{ background: glowCss, boxShadow: `0 0 10px ${glowCss}` }} />
          {cfg.lab}
        </span>
      </div>
    </div>
  );
}
