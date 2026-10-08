// One jump flood step: keep the nearest seed among the 3x3 neighbours at distance uStep.
precision highp float;
precision highp int;

uniform sampler2D uSeeds;
uniform int uStep;

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(uSeeds, 0);
  vec4 best = vec4(-1.0, -1.0, 0.0, 0.0);
  float bestD = 1e20;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      ivec2 q = p + ivec2(x, y) * uStep;
      if (any(lessThan(q, ivec2(0))) || any(greaterThanEqual(q, size))) continue;
      vec4 s = texelFetch(uSeeds, q, 0);
      if (s.w < 0.5) continue;
      vec2 d = s.xy - vec2(p);
      float d2 = dot(d, d);
      if (d2 < bestD) { bestD = d2; best = s; }
    }
  }
  gl_FragColor = best;
}
