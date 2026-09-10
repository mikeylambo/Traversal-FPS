export {};

const coarsePointer = matchMedia("(pointer: coarse)");

if (coarsePointer.matches) {
  const look = document.getElementById("look-pad");
  if (look) {
    let primaryPointer: number | null = null;

    look.addEventListener("pointerdown", (event) => {
      if (primaryPointer === null) {
        primaryPointer = event.pointerId;
        return;
      }

      if (event.pointerId !== primaryPointer) {
        /* FPSInput's legacy second-pointer path converts a second touch on the
           look surface into FIRE. On phone that makes gaps around the action
           cluster dangerous. Dedicated FIRE already handles simultaneous aim +
           shoot, so swallow only this extra pointer before it reaches FPSInput. */
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
