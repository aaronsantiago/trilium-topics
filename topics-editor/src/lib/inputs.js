let listeners = [];

function removeInputListener(listener) {
  listeners = listeners.filter(l => l !== listener);
}
export function addInputListener(listener) {
  listeners.push(listener);
  return () => removeInputListener(listener);
}

function handleInput(event) {
  listeners.forEach(listener => listener(event));
}

export function initInputs() {

  window.addEventListener("keydown", (e) => {
    if (e.key == "ArrowUp") {
      e.preventDefault();
      handleInput("up");
    }
    else if (e.key == "ArrowDown") {
      e.preventDefault();
      handleInput("down");
    }
    else if (e.key == "ArrowLeft") {
      e.preventDefault();
      handleInput("left");
    }
    else if (e.key == "ArrowRight") {
      e.preventDefault();
      handleInput("right");
    }
    else if (e.key == "Enter") {
      e.preventDefault();
      handleInput("confirm");
    }
    else if (e.key == "Escape") {
      e.preventDefault();
      handleInput("cancel");
    }
  });

  let keyState = {}

  let updateGamepad = () => {
    var gamepads = navigator.getGamepads();
    for (let gamepad of gamepads) {
      if (!gamepad?.buttons) continue;
      gamepad.buttons.forEach((button, i) => {
        if (button.pressed) {
          if (!keyState[i]) {
            console.log("Pressed: " + i);
            // if (i == 1) {
            //   inputTextArea.value = inputTextArea.value.slice(0, -1);
            //   handleChange({ target: inputTextArea });
            // }
            // if (i == 0) {
            //   handleInput({ key: " ", preventDefault: () => {} });
            // }
            // if (i == 13) {
            //   handleInput({ key: "Tab", preventDefault: () => {} });
            // }
            // if (i == 4) {
            //   inputTextArea.value += "t";
            //   handleChange({ target: inputTextArea });
            // }

            // if (i == 5) {
            //   inputTextArea.value += "n";
            //   handleChange({ target: inputTextArea });
            // }
            // if (i == 6) {
            //   inputTextArea.value += "s";
            //   handleChange({ target: inputTextArea });
            // }
            // if (i == 7) {
            //   inputTextArea.value += "e";
            //   handleChange({ target: inputTextArea });
            // }
            keyState[i] = true;
          }
        }
        else {
          keyState[i] = false;
        }
      });
    }
    requestAnimationFrame(updateGamepad);
  }
  requestAnimationFrame(updateGamepad);
}
