import { useEffect, useRef, type ReactNode } from "react";
import type { Location } from "react-router-dom";

/**
 * PageTransition — wraps route content.
 *
 * It deliberately does NOT re-key or animate the route container. Re-keying
 * unmounted and rebuilt the whole page on every section change, and the
 * container-level fade replayed on top of it — together they read as a full
 * browser refresh on every navigation. Navigation is now a plain swap; pages
 * keep their own local animations.
 */
const PageTransition = ({
  children,
  location,
}: {
  children: ReactNode;
  location?: Location;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = ref.current?.animate([{ opacity: 0.92, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" });
    return () => animation?.cancel();
  }, [location?.pathname]);
  return <div ref={ref} className="min-h-dvh">{children}</div>;
};

export default PageTransition;
