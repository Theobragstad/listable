// var textarea = document.getElementById("textarea");
// var limit = 80; //height limit

// textarea.oninput = function() {
//   textarea.style.height = "";
//   textarea.style.height = Math.min(textarea.scrollHeight, limit) + "px";
// };

let previousLength = 0;

const handleInput = (event) => {
  const bullet = "\u2022";
  const newLength = event.target.value.length;
  const characterCode = event.target.value.substr(-1).charCodeAt(0);

  if (newLength > previousLength) {
    if (characterCode === 10) {
      event.target.value = `${event.target.value}${bullet} `;
    } else if (newLength === 1) {
      event.target.value = `${bullet} ${event.target.value}`;
    }
  }
  
  previousLength = newLength;
}
