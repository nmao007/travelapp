// Index repeated place occurrences without querying the whole document per result.
export function createPlaceTargets() {
  const places = new Map();
  return {
    add(id, node) {
      if (!id) return;
      if (!places.has(id)) places.set(id, new Set());
      places.get(id).add(node);
    },
    get(id) { return places.get(id) || []; },
    prune() {
      for (const [id, nodes] of places) {
        for (const node of nodes) if (!node.isConnected) nodes.delete(node);
        if (!nodes.size) places.delete(id);
      }
    },
    clear() { places.clear(); },
  };
}
