// Final composite (port of image.glsl): final = albedo × fluence + emissive, reference
// tonemap, grayscale out. Also renders the debug views.
// With the tornado's swirl (drawn ink: two tones, see "Ink style" in CLAUDE.md), the
// layers go back to front: light flare → back strokes → lit works → hovered work →
// front strokes. Strokes are flat white; inside a flare they turn black, like ink
// silhouetted against the light.
precision highp float;
precision highp int;

in vec2 vUv;

uniform sampler2D uAlbedo;    // linear albedo (receivers)
uniform sampler2D uOccluder;
uniform sampler2D uEmissive;  // linear emitted radiance
uniform sampler2D uSDF;
uniform sampler2D uCascade0;
uniform sampler2D uDebugTex;  // cascade shown by the "cascade n" view
uniform sampler2D uSwirlBack;      // strokes behind a work (rgb flat tone, a coverage)
uniform sampler2D uSwirlFront;     // all other strokes, drawn over the works
uniform bool uHasSwirl;
uniform float uSwirlBrightness;    // white of the strokes (flat)
uniform float uFrontAlpha;         // front strokes opacity (1: ink is opaque, gusts thin it instead)
uniform float uFlareThreshold;     // light above the ambient that becomes a flat white flare
uniform float uFlareRays;          // raggedness of the flare's edge
uniform vec2 uBoil;                // outline noise offset, redrawn at the boil rate
uniform float uImpact;             // click impact frame: 0 none, 1 silhouette, 2 inverted silhouette
uniform float uImpactLevel;        // brightest value an impact frame uses (never full white)
uniform float uThumbBrightness;    // works' albedo scale (the hovered work stays at full)
uniform float uAmbientFluence;     // fluence the ambient alone gives in open space
uniform sampler2D uHighlight;      // hovered work rendered alone (rgb linear, a = coverage)
uniform float uHighlightAmount;    // 0..1 fade of the hovered work
uniform float uEmissiveScale;
uniform float uExposure;
uniform float uSaturation;    // 0 = grayscale output (default)
uniform int uView;            // 0 final, 1 albedo, 2 occluders, 3 emissive, 4 SDF, 5 cascade n, 6 fluence

const float PI = 3.1415927;

vec3 tonemap(vec3 x) { return 1.0 - 1.0 / pow(1.0 + x, vec3(2.5)); }   // from the reference
vec3 toDisplay(vec3 linear) { return pow(max(linear, 0.0), vec3(1.0 / 2.2)); }
vec3 grade(vec3 c) {
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luma), c, uSaturation);
}

// Fluence at this pixel: cascade 0 upsampled bilinearly (one texture() does the
// reference's 4-probe mix), then the exact SDF data near surfaces to fix the edges.
vec3 fluenceAt(vec2 uv) {
  vec3 fluence = texture(uCascade0, uv).rgb * 2.0 * PI;
  vec4 data = texture(uSDF, uv);
  return mix(fluence, data.gba * 2.0 * PI, clamp(3.0 - data.r, 0.0, 1.0));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Drawn impact frame (Spider-Verse style): hard two-tone silhouettes for a single frame,
// capped below white; the inverted frame's light field is dimmer still (photosensitivity)
vec3 impactFrame(vec3 col) {
  float sil = step(0.1, dot(col, vec3(0.2126, 0.7152, 0.0722)));
  if (uImpact < 1.5) return vec3(sil * uImpactLevel);
  return vec3((1.0 - sil) * uImpactLevel * 0.55);
}

void main() {
  vec3 col;
  if (uView == 1) {
    col = toDisplay(texture(uAlbedo, vUv).rgb);
  } else if (uView == 2) {
    col = vec3(texture(uOccluder, vUv).r);
  } else if (uView == 3) {
    col = tonemap(texture(uEmissive, vUv).rgb * uEmissiveScale * 2.0 * PI);
  } else if (uView == 4) {
    // Distance bands outside, red inside; emitters tinted by their emissivity
    vec4 data = texture(uSDF, vUv);
    float r = data.r;
    col = r < 0.0
      ? vec3(0.8, 0.15, 0.15) * (0.6 + 0.4 * fract(-r / 8.0))
      : vec3(0.15 + 0.35 * fract(r / 16.0)) * exp(-r / 400.0);
    col = mix(col, tonemap(data.gba * 2.0 * PI), 0.5 * float(max(data.g, max(data.b, data.a)) > 0.0));
  } else if (uView == 5) {
    vec4 c = texture(uDebugTex, vUv);
    col = tonemap(c.rgb * 2.0 * PI);
  } else if (uView == 6) {
    col = tonemap(fluenceAt(vUv));
  } else {
    vec3 fluence = fluenceAt(vUv);
    vec4 albedo = texture(uAlbedo, vUv);
    vec4 em = texture(uEmissive, vUv);
    // Only emitters drawn with alpha 1 (the cursor disc) are seen directly. The inner
    // lights (alpha 0) show only through the light they cast.
    vec3 emissive = em.rgb * em.a * uEmissiveScale * 2.0 * PI;
    float emitting = step(0.0001, max(emissive.r, max(emissive.g, emissive.b)));
    vec3 works = tonemap((albedo.rgb * uThumbBrightness * fluence + emissive) * uExposure);
    vec3 ink = vec3(uSwirlBrightness);
    if (uHasSwirl) {
      // Light drawn as ink: where the light above the ambient is strong it becomes a flat
      // white flare (no gradient). Its edge is ragged, and the RC shadows of strokes and
      // debris cut black rays into it. Cascade 0 alone: no hard emitter discs.
      vec3 softFluence = texture(uCascade0, vUv).rgb * 2.0 * PI;
      float glow = dot(max(softFluence - uAmbientFluence, 0.0), vec3(0.2126, 0.7152, 0.0722));
      vec2 px = gl_FragCoord.xy;
      float n = 0.65 * vnoise(px / 9.0 + uBoil) + 0.35 * vnoise(px / 3.0 - uBoil);
      float w = fwidth(glow) + 1e-4;
      float flare = smoothstep(-w, w, glow - uFlareThreshold + (n - 0.5) * uFlareRays * uFlareThreshold);
      col = vec3(uSwirlBrightness * flare);
      // Strokes over the flare read as black ink against the light
      ink = mix(vec3(uSwirlBrightness), vec3(0.0), flare);
      vec4 back = texture(uSwirlBack, vUv);
      col = mix(col, ink * back.rgb, back.a);   // rgb: the stroke's flat tone (far = dimmer)
      col = mix(col, works, max(albedo.a, emitting));
    } else {
      col = works;
    }
    // Everything is grayscale; the hovered work then shows at full brightness and in color.
    // It's composited, not injected as an emitter, so it doesn't light its neighbours.
    col = grade(col);
    vec4 hl = texture(uHighlight, vUv);
    col = mix(col, toDisplay(hl.rgb), hl.a * uHighlightAmount);
    if (uHasSwirl) {
      // The near wall's strokes cover the works where they pass; the works show in the
      // gaps between strokes. The hover hole is already cut in the layer.
      vec4 front = texture(uSwirlFront, vUv);
      col = mix(col, ink * front.rgb, front.a * uFrontAlpha);
    }
    if (uImpact > 0.5) col = impactFrame(col);
    gl_FragColor = vec4(col, 1.0);
    return;
  }
  gl_FragColor = vec4(grade(col), 1.0);
}
