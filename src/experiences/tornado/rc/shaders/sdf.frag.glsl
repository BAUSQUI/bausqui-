// Resolve the jump flood into the Buffer B format of the reference:
//   r   = signed distance in SDF texels (negative inside solids)
//   gba = emissivity of the nearest surface (the reference's Voronoi-owner rule)
uniform sampler2D uSeeds;
uniform float uEmissiveScale;

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  bool solid = solidAt(p);
  vec4 s = texelFetch(uSeeds, p, 0);

  if (s.w < 0.5) {
    // No surface anywhere on screen (or one solid filling it)
    gl_FragColor = vec4(solid ? -1e4 : 1e4, 0.0, 0.0, 0.0);
    return;
  }

  float d = distance(s.xy, vec2(p));
  // -0.5 puts the zero crossing between the boundary texel and its empty neighbour
  float sd = (solid ? -d : d) - 0.5;
  vec3 emission = texelFetch(uEmissive, ivec2(s.xy), 0).rgb * uEmissiveScale;
  gl_FragColor = vec4(sd, emission);
}
