/* global module */
// A verify call answers status 'OK' even when the signature doesn't match,
// so the outcome has to come from result.valid, not the status alone.
const describeResponse = (response, successText) => {
  if (response.status !== 'OK') {
    return { ok: false, errors: response.errors };
  }
  const result = response.result || {};
  if (result.valid === false) {
    return { ok: false, errors: ['Invalid! These dice do not match what this server rolled.'] };
  }
  if (result.valid === true && result.legacy) {
    return { ok: true, text: 'Valid (old format, weakly protected)' };
  }
  return { ok: true, text: successText };
};

if (typeof window !== 'undefined') {
  window.registerForm = (formId, buttonId, errorDisplayId, text, successText) => {
    const form = document.getElementById(formId);
    const button = document.getElementById(buttonId);
    const errorDisplay = document.getElementById(errorDisplayId);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      button.disabled = true;
      button.value = '';
      button.innerHTML = '<div class="lds-dual-ring"></div>';
      const request = new XMLHttpRequest();
      request.addEventListener('load', (serverResponse) => {
        const outcome = describeResponse(
          JSON.parse(serverResponse.target.responseText),
          successText,
        );
        button.disabled = false;
        if (outcome.ok) {
          errorDisplay.style.display = 'none';
          button.textContent = outcome.text;
        } else {
          errorDisplay.style.display = 'block';
          // Errors can echo user input (an email), so they go in as text.
          errorDisplay.replaceChildren(...outcome.errors.flatMap((error, i) => (
            i === 0 ? [error] : [document.createElement('br'), error]
          )));
          button.textContent = text;
        }
      });
      request.open(form.getAttribute('method'), form.getAttribute('action'));
      // urlencode the FormData
      request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      request.send([...formData.entries()].map((e) => `${encodeURIComponent(e[0])}=${encodeURIComponent(e[1])}`).join('&'));
    });
  };
}

if (typeof module !== 'undefined') {
  module.exports = { describeResponse };
}
