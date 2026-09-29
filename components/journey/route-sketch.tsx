import { Icon } from "./icon";
export function RouteSketch({ stops = ["Asakusa", "Shinjuku", "Shibuya"] }: { stops?: string[] }) {
  return <div className="j-route-sketch" aria-label="Illustrative route preview, not a navigable map">
    <svg viewBox="0 0 400 230" fill="none" aria-hidden="true"><rect width="400" height="230" fill="#edf0e8" /><path d="M-10 30 410 200M-10 150 350-10M60 240 250-10M200 240 410 70M0 80 400 80M0 180 400 180" stroke="#fff" strokeWidth="12" /><path d="M310-10c-75 55 90 90 10 145s-15 70-35 105" stroke="#cddfe3" strokeWidth="24" /><path d="M78 60Q90 140 191 130T290 185" stroke="#31785d" strokeWidth="3" strokeDasharray="6 5" />{[[78,60],[191,130],[290,185]].map(([x,y],index) => <g key={index}><circle cx={x} cy={y} r="12" fill="#23634d" stroke="white" strokeWidth="3" /><text x={x} y={y+4} fill="white" textAnchor="middle" fontSize="10" fontFamily="sans-serif">{index+1}</text></g>)}</svg>
    <span className="j-map-label"><Icon name="pin" size={13} /> Route concept</span>
    <p>{stops.slice(0,3).join(" · ")}</p>
  </div>;
}
