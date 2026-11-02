/** Words that depend on the device: read at render time (the phone and desktop layouts are separate trees). */
const mq = (q: string) => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches;

/** A touch screen without hover: "누르면" instead of "마우스를 올리면". */
export const isTouch = () => mq('(hover: none)');

/** The phone layout (one screen at a time, tabs along the bottom). Same breakpoint as App. */
export const isPhone = () => mq('(max-width: 767px)');
