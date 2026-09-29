import type { CSSProperties } from "react";
export type IconName = "more" | "today" | "plan" | "explore" | "wallet" | "tools" | "plane" | "stay" | "transport" | "pin" | "clock" | "arrow" | "chevron" | "plus" | "search" | "check" | "bag" | "document" | "globe" | "shield" | "users" | "settings" | "close" | "bookmark" | "edit" | "food";
const paths: Record<IconName, string[]> = {
  more: ["M5 12h.01M12 12h.01M19 12h.01"],
  today: ["M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4", "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"],
  plan: ["M5 5h14v15H5zM8 3v4m8-4v4M5 10h14M8 14h3m-3 3h7"],
  explore: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", "m16 8-3 5-5 3 3-5 5-3Z"],
  wallet: ["M4 6h14v14H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12v2", "M14 11h7v5h-7zM17 13.5h.1"],
  tools: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
  plane: ["m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"],
  stay: ["M3 20V7h18v13M3 15h18M7 11h3m4 0h3M3 18h18"],
  transport: ["M6 3h12v14H6zM6 8h12M9 20l-2 2m8-2 2 2M9 13h.1m5.9 0h.1"],
  pin: ["M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z", "M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"],
  clock: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2"],
  arrow: ["M4 12h16m-6-6 6 6-6 6"], chevron: ["m9 5 7 7-7 7"], plus: ["M12 5v14M5 12h14"], search: ["M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6"], check: ["m5 12 4 4L19 6"],
  bag: ["M5 7h14v14H5zM9 7V4h6v3M9 11v6m6-6v6"],
  document: ["M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"],
  globe: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"],
  shield: ["m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z", "m8 12 3 3 5-6"],
  users: ["M14 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 20v-3a5 5 0 0 1 10 0v3M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2"],
  settings: ["M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6 2.1 2.1m8.6 8.6 2.1 2.1m-12.8 0 2.1-2.1m8.6-8.6 2.1-2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"],
  close: ["m6 6 12 12M18 6 6 18"], bookmark: ["M6 3h12v18l-6-4-6 4V3Z"], edit: ["m15 4 5 5M4 20l4-1L21 6l-4-4L4 15v5Z"], food: ["M5 3v6m3-6v6m3-6v6M5 9h6m-3 0v12M18 3c-4 3-4 9 0 9V3Zm0 9v9"],
};
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name].map((d, index) => <path d={d} key={index} />)}</svg>;
}
