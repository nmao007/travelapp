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

// Save coordinates, not DOM nodes: updates may replace a list while it is away.
export function createWorkspacePositions(targets) {
  let scope = null;
  const positions = new Map();
  const sync = id => { if (scope !== id) { scope = id; positions.clear(); } };
  return {
    save(id, view) {
      sync(id);
      positions.set(view, targets(view).filter(Boolean).map(node => ({ id: node.id, top: node.scrollTop, left: node.scrollLeft })));
    },
    restore(id, view) {
      sync(id);
      const saved = new Map((positions.get(view) || []).map(position => [position.id, position]));
      for (const node of targets(view).filter(Boolean)) {
        const position = saved.get(node.id);
        if (position) { node.scrollTop = position.top; node.scrollLeft = position.left; }
      }
    },
    reset() { scope = null; positions.clear(); },
  };
}
