export {};

const coarsePointer = matchMedia("(pointer: coarse)");

if (coarsePointer.matches) {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
  const controls = document.getElementById("mobile-controls");
  const look = document.getElementById("look-pad");

  /* On iOS, an uncovered touch can synthesize a mouse event on the canvas. The
     desktop mouse handler interprets primary-button mousedown as FIRE. Touch FPS
     input is owned by the dedicated controls, so suppress compatibility mouse
     events originating from bare-canvas touches. */
  canvas?.addEventListener("touchstart", (event) => {
    if (!document.body.classList.contains("touch-gameplay")) return;
    event.preventDefault();
  }, { capture: true, passive: false });

  /* The full mobile-control layer owns touch gameplay. Empty space is deliberately
     inert: it must never fall through to the canvas and become a rifle shot. */
  controls?.addEventListener("pointerdown", (event) => {
    if (!document.body.classList.contains("touch-gameplay")) return;
    if (event.target !== controls) return;
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true });

  if (look) {
    let primaryPointer: number | null = null;

    look.addEventListener("pointerdown", (event) => {
      if (primaryPointer === null) {
        primaryPointer = event.pointerId;
        return;
      }

      if (event.pointerId !== primaryPointer) {
        /* Looking is looking. A second finger on the look surface no longer
           doubles as an invisible FIRE command; the visible FIRE control owns it. */
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, { capture: true });

    const release = (event: PointerEvent) => {
      if (event.pointerId === primaryPointer) primaryPointer = null;
    };
    look.addEventListener("pointerup", release, { capture: true });
    look.addEventListener("pointercancel", release, { capture: true });
  }
}
