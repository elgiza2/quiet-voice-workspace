export function clampCallPosition(x: number, y: number, width: number, height: number, containerWidth: number, containerHeight: number, top = 76, bottom = 88) {
  return { x: Math.max(8, Math.min(x, containerWidth - width - 8)), y: Math.max(top, Math.min(y, containerHeight - height - bottom)) };
}