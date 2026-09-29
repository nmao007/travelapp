import type { PoiCategory } from '@/lib/poi-service';

const paths: Record<PoiCategory, string> = {
  Sights: 'M12 3 9 8l3-1 3 1-3-5ZM5 10h14v10H5V10Zm4 4h6m-3-4v10',
  Culture: 'M3 9 12 4l9 5M5 9v11h14V9M9 12v5m6-5v5M3 20h18',
  Nature: 'M12 3 5 13h4l-3 4h12l-3-4h4L12 3Zm0 14v4',
  Food: 'M5 3v6m3-6v6m3-6v6M5 9h6m-3 0v12M18 3c-4 3-4 9 0 9V3Zm0 9v9',
};

export function createPlacePin(name: string, category: PoiCategory, options: { planned?: boolean; idea?: boolean; compact?: boolean; selected?: boolean } = {}): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `m-poi-pin m-poi-${category.toLowerCase()}${options.planned ? ' m-trip-pin planned' : options.idea ? ' m-trip-pin idea' : ''}${options.compact ? ' compact' : ''}${options.selected ? ' selected' : ''}`;
  button.setAttribute('aria-label', `${name}, ${options.planned ? 'in your plan' : options.idea ? 'saved idea' : category}`);
  button.title = name;
  const icon = document.createElement('span');
  icon.className = 'm-poi-pin-icon';
  icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[category]}"/></svg>`;
  const label = document.createElement('span');
  label.className = 'm-poi-pin-label';
  label.textContent = name;
  button.append(icon, label);
  return button;
}
