import { createContext, useCallback, useContext, useMemo, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, type ScrollView } from 'react-native';
import { Text } from '@/components/text';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { insertPlan, planDropPosition } from '@trippilot/core/itinerary-model';
import { PlaceMarker, DragHandleIcon } from './plan-row';
import { colors, fonts, sq } from '@/lib/theme';
import type { PlanItem, Trip } from '@/lib/trips';
import { haptics } from '@/lib/haptics';

type ViewRef = ComponentRef<typeof View>;
type ScrollRef = ComponentRef<typeof ScrollView>;
type Rect = { x: number; y: number; width: number; height: number };
type Target = { day: string; beforeId: string | null } | null;
type Drag = { item: PlanItem; x: number; y: number; offsetY: number; width: number; target: Target };

type DragContextValue = {
  register(kind: 'row' | 'day', key: string, view: ViewRef | null, day: string): void;
  start(item: PlanItem, x: number, y: number): void;
  move(x: number, y: number): void;
  end(drop: boolean): void;
  draggingId: string | null;
  target: Target;
};

const DragContext = createContext<DragContextValue | null>(null);
const EDGE = 64, STEP = 10;

// planning-drag.js for touch: hold the grip, move the plan to another place in
// the day or onto another day, and let go. Fixed-time plans have no grip.
export function DragProvider({ trip, commit, onDrop, scrollRef, scrollOffset, children }: {
  trip: Trip; commit(trip: Trip): void; onDrop(day: string): void; scrollRef: RefObject<ScrollRef | null>; scrollOffset: { current: number }; children: ReactNode;
}) {
  const views = useRef(new Map<string, { kind: 'row' | 'day'; view: ViewRef; day: string }>());
  const rects = useRef(new Map<string, Rect & { kind: 'row' | 'day'; day: string }>());
  const startScroll = useRef(0), frame = useRef<ViewRef>(null), frameRect = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const scrollTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const tripRef = useRef(trip); tripRef.current = trip;

  const register = useCallback((kind: 'row' | 'day', key: string, view: ViewRef | null, day: string) => {
    const id = `${kind}:${key}`;
    if (view) views.current.set(id, { kind, view, day }); else views.current.delete(id);
  }, []);

  // Which day (and which plan to go before) is under the finger.
  const locate = useCallback((y: number, id: string): Target => {
    const shift = scrollOffset.current - startScroll.current;
    let day: string | null = null;
    for (const rect of rects.current.values()) if (rect.kind === 'day' && y >= rect.y - shift && y <= rect.y - shift + rect.height) day = rect.day;
    if (!day) return null;
    const rows = [...rects.current.entries()].filter(([key, rect]) => rect.kind === 'row' && rect.day === day && key !== `row:${id}`).sort((a, b) => a[1].y - b[1].y);
    const before = rows.find(([, rect]) => y < rect.y - shift + rect.height / 2);
    const beforeId = before ? before[0].slice(4) : null;
    // Plan rows register their id and flight rows their "transport:…" event
    // key; planDropPosition adds "plan:" to bare ids itself.
    const placement = planDropPosition(tripRef.current, id, day, beforeId as never) as { allowed: boolean };
    return placement.allowed ? { day, beforeId } : null;
  }, [scrollOffset]);

  const update = useCallback((next: Drag | null) => { dragRef.current = next; setDrag(next); }, []);

  const value = useMemo<DragContextValue>(() => ({
    register,
    start(item, x, y) {
      startScroll.current = scrollOffset.current;
      frame.current?.measureInWindow((fx, fy, width, height) => { frameRect.current = { x: fx, y: fy, width, height }; });
      rects.current.clear();
      for (const [key, entry] of views.current) entry.view.measureInWindow((rx, ry, width, height) => rects.current.set(key, { x: rx, y: ry, width, height, kind: entry.kind, day: entry.day }));
      const own = views.current.get(`row:${item.id}`);
      own?.view.measureInWindow((_, ry, width) => { if (dragRef.current) update({ ...dragRef.current, offsetY: y - ry, width }); });
      update({ item, x, y, offsetY: 30, width: 340, target: null });
      haptics.lift();
      // Scroll while the finger rests near the top or bottom edge.
      clearInterval(scrollTimer.current);
      scrollTimer.current = setInterval(() => {
        const current = dragRef.current, area = frameRect.current;
        if (!current || !area.height) return;
        const delta = current.y < area.y + EDGE ? -STEP : current.y > area.y + area.height - EDGE ? STEP : 0;
        if (!delta) return;
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollOffset.current + delta), animated: false });
        update({ ...current, target: locate(current.y, current.item.id) });
      }, 16);
    },
    move(x, y) {
      const current = dragRef.current;
      if (!current) return;
      const target = locate(y, current.item.id);
      if (target && target.day !== current.target?.day) haptics.select();
      update({ ...current, x, y, target });
    },
    end(drop) {
      clearInterval(scrollTimer.current);
      const current = dragRef.current;
      update(null);
      if (!drop || !current?.target) return;
      const next = insertPlan(tripRef.current, current.item.id, current.target.day, current.target.beforeId as never) as Trip;
      if (next !== tripRef.current) { commit(next); onDrop(current.target.day); haptics.drop(); }
    },
    draggingId: drag?.item.id ?? null,
    target: drag?.target ?? null,
  }), [register, scrollOffset, scrollRef, locate, update, commit, onDrop, drag]);

  return (
    <DragContext.Provider value={value}>
      <View ref={frame} collapsable={false} style={styles.frame}>
        {children}
        {drag ? (
          // .drag-ghost: a floating copy of the plan under the finger.
          <View pointerEvents="none" style={[styles.ghost, { top: drag.y - frameRect.current.y - drag.offsetY, width: drag.width }]}>
            <PlaceMarker item={drag.item} />
            <Text style={styles.ghostName} numberOfLines={1}>{drag.item.name}</Text>
          </View>
        ) : null}
      </View>
    </DragContext.Provider>
  );
}

export function useDrag() { return useContext(DragContext); }

// The grip on flexible plans (.mobile-drag-handle).
export function DragHandle({ item }: { item: PlanItem }) {
  const drag = useDrag();
  const pan = usePanGesture({
    minDistance: 2,
    runOnJS: true,
    onActivate: event => drag?.start(item, event.absoluteX, event.absoluteY),
    onUpdate: event => { if ('absoluteY' in event) drag?.move(event.absoluteX, event.absoluteY); },
    onFinalize: event => drag?.end(!event.canceled),
  });
  return (
    <GestureDetector gesture={pan}>
      <View style={styles.handle} accessible accessibilityLabel={`Drag ${item.name}`} accessibilityHint="Drag to move"><DragHandleIcon /></View>
    </GestureDetector>
  );
}

// Wraps a day section or plan row so drops can find it, and shows the
// .drop-target highlight on the day being dropped into.
export function DropZone({ kind, id, day, children }: { kind: 'row' | 'day'; id: string; day: string; children: ReactNode }) {
  const drag = useDrag();
  const active = kind === 'day' && drag?.target?.day === day;
  const dragging = kind === 'row' && drag?.draggingId === id;
  return (
    <View ref={view => drag?.register(kind, id, view, day)} collapsable={false} style={[active && styles.dropTarget, dragging && styles.source]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  handle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ghost: {
    position: 'absolute', left: 20, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
    borderWidth: 1, borderColor: '#f1c9b5', borderRadius: sq(20), borderCurve: 'continuous', backgroundColor: colors.white,
    shadowColor: '#492b19', shadowOpacity: 0.09, shadowRadius: 12, shadowOffset: { width: 0, height: 8 },
  },
  ghostName: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.25, color: '#252525' },
  dropTarget: { backgroundColor: '#fff2eb', borderRadius: sq(18), borderCurve: 'continuous', outlineWidth: 1, outlineStyle: 'dashed', outlineColor: '#e88c60', outlineOffset: -3 },
  source: { opacity: 0.35 },
});
