// Interface every home experience implements. main.js mounts exactly one.
//
// ctx = {
//   renderer,            shared THREE.WebGLRenderer (canvas already in the DOM)
//   openProject(id),     open the project overlay for a project id (data/projects.js)
// }
export class Experience {
  // Loading-screen checklist entries for this experience's own assets: { key: { es, en } }.
  // The experience calls window.__loaderDone(key) when each one is ready.
  static loaderKeys = {}

  init(ctx) {}

  // Called once per animation frame; the experience renders itself.
  update(dt) {}

  resize(w, h) {}

  dispose() {}

  // A project card was clicked. Run the experience's own exit transition, then call
  // ctx.openProject(project.id). Return false if the selection was ignored.
  selectProject(project) { return false }

  // An overlay opened or closed on top of the canvas. kind: 'project' | 'info'.
  onOverlay(kind, open) {}
}
