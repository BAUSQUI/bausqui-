// JFA seeds: solid texels on the inner boundary of a solid region store their own
// coordinate. Everything else stores "no seed" (w = 0).
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  bool solid = solidAt(p);
  bool edge = solid && (
    !solidAt(p + ivec2(1, 0)) || !solidAt(p - ivec2(1, 0)) ||
    !solidAt(p + ivec2(0, 1)) || !solidAt(p - ivec2(0, 1))
  );
  gl_FragColor = edge ? vec4(vec2(p), 0.0, 1.0) : vec4(-1.0, -1.0, 0.0, 0.0);
}
