export function initGamepad() {

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
