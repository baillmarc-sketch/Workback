export function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/** Phone-sized viewport — popovers become bottom sheets below this */
export function isNarrowViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 640;
}
