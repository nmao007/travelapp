// Keep the origin of a detail view, including its selection and scroll position.
export function createPlanNavigation() {
  let trip = null, frames = [];
  const sync = id => { if (trip !== id) { trip = id; frames = []; } };
  return {
    enter(id, origin, nextMode) {
      sync(id);
      if (origin.mode === nextMode) return;
      if (nextMode === 'list') frames = [];
      else frames.push({ ...origin });
    },
    peek(id) { sync(id); return frames.at(-1) || null; },
    back(id) { sync(id); return frames.pop() || null; },
    reset(id) { trip = id; frames = []; },
  };
}
