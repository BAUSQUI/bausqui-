// Shared by the SDF passes. A texel is "solid" if it blocks light (occluder mask)
// or emits light (emissive buffer). Emitters must be solid so rays can hit them.
precision highp float;
precision highp int;

uniform sampler2D uOccluder;   // r > 0.5 = occluder
uniform sampler2D uEmissive;   // rgb = emitted radiance

bool solidAt(ivec2 p) {
  ivec2 size = textureSize(uOccluder, 0);
  p = clamp(p, ivec2(0), size - 1);   // off-screen counts as "same as the edge": no fake boundary
  vec3 e = texelFetch(uEmissive, p, 0).rgb;
  return texelFetch(uOccluder, p, 0).r > 0.5 || max(e.r, max(e.g, e.b)) > 1e-4;
}
