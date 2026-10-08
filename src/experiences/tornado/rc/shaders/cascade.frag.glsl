// Radiance cascade n. Port of cube-a.glsl (Shadertoy mtlBzX, fad) with the cubemap
// memory trick replaced by one 2D target per cascade, laid out direction-major:
//
//   the texture is a B x B grid of blocks (B = sqrt(directions stored)); block (bx, by)
//   holds direction d = by * B + bx for every probe, so each block is a small image of
//   the cascade's probes. Cascade 0 stores one direction (B = 1), cascades n >= 1 are
//   all exactly 2*c0 x 2*c0 texels.
//
// Because a direction is a contiguous image, hardware LINEAR filtering performs the
// reference's manual S0..S3 probe interpolation when merging with cascade n + 1.
// Every cascade is computed top-down within the same frame: no temporal lag.
precision highp float;
precision highp int;

uniform sampler2D uSDF;      // r = signed distance (SDF texels), gba = emissivity
uniform sampler2D uUpper;    // cascade n + 1 (unused for the top cascade)
uniform vec2 uUpperSize;     // texel size of uUpper
uniform vec2 uSdfRes;        // SDF resolution: rays are traced in SDF-texel units
uniform ivec2 uC0;           // spatial resolution of cascade 0 (multiple of 2^(nCascades-1))
uniform int uN;              // this cascade
uniform int uNCascades;
uniform int uCDRes;          // directions in cascade 0 (a perfect square: 16)
uniform vec3 uAmbient;       // replaces the reference's sky: merged into the top cascade

const float PI = 3.1415927;

vec4 sampleSDF(vec2 P) {
  return texture(uSDF, P / uSdfRes);
}

vec2 intersectAABB(vec2 ro, vec2 rd, vec2 a, vec2 b) {
  vec2 ta = (a - ro) / rd;
  vec2 tb = (b - ro) / rd;
  vec2 t1 = min(ta, tb);
  vec2 t2 = max(ta, tb);
  vec2 t = vec2(max(t1.x, t1.y), min(t2.x, t2.y));
  return t.x > t.y ? vec2(-1.0) : t;
}

// Distance along the ray to the first surface within tMax, or -1
float intersect(vec2 ro, vec2 rd, float tMax) {
  float tOffset = 0.0;
  // Clip the ray to the screen rectangle first
  vec2 tAABB = intersectAABB(ro, rd, vec2(0.0001), uSdfRes - 0.0001);
  if (tAABB.x > tMax || tAABB.y < 0.0) return -1.0;
  if (tAABB.x > 0.0) { ro += tAABB.x * rd; tOffset += tAABB.x; tMax -= tAABB.x; }
  if (tAABB.y < tMax) tMax = tAABB.y;

  float t = 0.0;
  for (int i = 0; i < 100; i++) {
    float d = sampleSDF(ro + rd * t).r;
    t += abs(d);
    if (t >= tMax) break;
    if (0.2 < t && d < 1.0) return tOffset + t;
  }
  return -1.0;
}

// Radiance (rgb) and visibility (a) for one ray interval
vec4 radiance(vec2 ro, vec2 rd, float tMax) {
  vec4 p = sampleSDF(ro);
  if (p.r > 0.0) {
    float t = intersect(ro, rd, tMax);
    if (t == -1.0) return vec4(0.0, 0.0, 0.0, 1.0);
    p = sampleSDF(ro + rd * t);
  }
  return vec4(p.gba, 0.0);
}

int dirsStored(int n) { return n == 0 ? 1 : uCDRes << (2 * (n - 1)); }
int blockGrid(int n)  { return int(round(sqrt(float(dirsStored(n))))); }

void main() {
  int n = uN;
  ivec2 sRes = uC0 >> n;
  int B = blockGrid(n);
  ivec2 texel = ivec2(gl_FragCoord.xy);
  ivec2 block = texel / sRes;
  ivec2 p = texel - block * sRes;          // probe index
  int d = block.y * B + block.x;           // stored direction index

  int nDirs = uCDRes << (2 * n);           // rays cast by this cascade
  int raysPer = nDirs / dirsStored(n);     // rays pre-averaged into each stored direction

  vec2 ro = (vec2(p) + 0.5) / vec2(sRes) * uSdfRes;
  float t1 = length(uSdfRes) * 4.0 / (float(1 << (2 * uNCascades)) - 1.0);
  float tMin = n == 0 ? 0.0 : t1 * float(1 << (2 * (n - 1)));
  float tMax = t1 * float(1 << (2 * n));

  // Upper cascade layout (for the merge)
  ivec2 sResU = uC0 >> (n + 1);
  int BU = blockGrid(n + 1);
  vec2 pf = (vec2(p) + 0.5) / 2.0;          // this probe in upper-probe texel coords
  vec2 pfClamped = clamp(pf, vec2(0.5), vec2(sResU) - 0.5);   // = the reference's index clamp

  vec4 s = vec4(0.0);
  for (int i = 0; i < raysPer; ++i) {
    int j = raysPer * d + i;
    float angle = (float(j) + 0.5) / float(nDirs) * 2.0 * PI;
    vec2 rd = vec2(cos(angle), sin(angle));
    vec4 si = radiance(ro + rd * tMin, rd, tMax - tMin);

    // If the ray escaped (non-zero visibility), add what lies beyond it
    if (si.a != 0.0) {
      if (n == uNCascades - 1) {
        si.rgb += si.a * uAmbient;
      } else {
        vec2 origin = vec2(ivec2(j % BU, j / BU) * sResU);
        vec4 S = texture(uUpper, (origin + pfClamped) / uUpperSize);
        si.rgb += si.a * S.rgb;
        si.a *= S.a;
      }
    }
    s += si;
  }
  gl_FragColor = s / float(raysPer);
}
