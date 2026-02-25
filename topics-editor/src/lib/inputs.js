let listeners = [];

let axisListeners = [];

function removeInputListener(listener) {
  listeners = listeners.filter(l => l !== listener);
}
export function addInputListener(listener) {
  listeners.push(listener);
  return () => removeInputListener(listener);
}

function removeAxisListener(listener) {
  axisListeners = axisListeners.filter(l => l !== listener);
}

export function addAxisListener(listener) {
  axisListeners.push(listener);
  return () => removeAxisListener(listener);
}

function handleInput(event) {
  listeners.forEach(listener => listener(event));
}

function handleAxis(event) {
  axisListeners.forEach(listener => listener(event));
}

export function initInputs() {

  window.addEventListener("keydown", (e) => {
    // if (e.key == "3") {
    //   handleInput("l2")
    //   e.preventDefault();
    // }
    // if (e.key == "4") {
    //   handleInput("l1")
    //   e.preventDefault();
    // }
    // if (e.key == "7") {
    //   handleInput("r1")
    //   e.preventDefault();
    // }
    // if (e.key == "8") {
    //   handleInput("r2")
    //   e.preventDefault();
    // }
    // if (e.key == "0") {
    //   handleInput("delete")
    //   e.preventDefault();
    // }
    // if (e.key == "ArrowUp") {
    //   e.preventDefault();
    //   handleInput("up");
    // }
    // else if (e.key == "ArrowDown") {
    //   e.preventDefault();
    //   handleInput("down");
    // }
    // else if (e.key == "ArrowLeft") {
    //   e.preventDefault();
    //   handleInput("left");
    // }
    // else if (e.key == "ArrowRight") {
    //   e.preventDefault();
    //   handleInput("right");
    // }
    // else if (e.key == "Enter") {
    //   e.preventDefault();
    //   handleInput("confirm");
    // }
    // else if (e.key == "Escape") {
    //   e.preventDefault();
    //   handleInput("cancel");
    // }
  });

  const REPEAT_INITIAL_DELAY_MS = 400;
  const REPEAT_INTERVAL_MS = 100;
  const DPAD_BUTTONS = new Set([12, 13, 14, 15]);

  let keyState = {};
  let holdTimestamps = {};

  function dispatchButtonEvent(i) {
    if (i == 8) handleInput("cancel");
    if (i == 1) handleInput("confirm");
    if (i == 3) handleInput("delete");
    if (i == 4) handleInput("l1");
    if (i == 5) handleInput("r1");
    if (i == 6) handleInput("l2");
    if (i == 7) handleInput("r2");
    if (i == 10) handleInput("l3");
    if (i == 12) handleInput("up");
    if (i == 13) handleInput("down");
    if (i == 14) handleInput("left");
    if (i == 15) handleInput("right");
  }

  let updateGamepad = () => {
    var gamepads = navigator.getGamepads();
    for (let gamepad of gamepads) {
      if (!gamepad?.buttons) continue;
      gamepad.axes.forEach((axis, i) => {
        if (i == 0) {
          handleAxis({ axis: "lx", value: axis });
        }
        if (i == 1) {
          handleAxis({ axis: "ly", value: axis });
        }
        if (i == 2) {
          handleAxis({ axis: "rx", value: axis });
        }
        if (i == 3) {
          handleAxis({ axis: "ry", value: axis });
        }
      });

      gamepad.buttons.forEach((button, i) => {
        if (button.pressed) {
          const now = performance.now();
          if (!keyState[i]) {
            console.log("Pressed: " + i);
            dispatchButtonEvent(i);
            keyState[i] = true;
            if (DPAD_BUTTONS.has(i)) {
              holdTimestamps[i] = { pressedAt: now, lastRepeatAt: now };
            }
          } else if (DPAD_BUTTONS.has(i) && holdTimestamps[i]) {
            const { pressedAt, lastRepeatAt } = holdTimestamps[i];
            if (now - pressedAt >= REPEAT_INITIAL_DELAY_MS &&
                now - lastRepeatAt >= REPEAT_INTERVAL_MS) {
              dispatchButtonEvent(i);
              holdTimestamps[i].lastRepeatAt = now;
            }
          }
        } else {
          keyState[i] = false;
          delete holdTimestamps[i];
        }
      });
    }
    requestAnimationFrame(updateGamepad);
  }
  requestAnimationFrame(updateGamepad);
}
