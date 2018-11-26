window.registerForm = (formId, buttonId, errorDisplayId, method, url, text, successText) => {
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
      const response = JSON.parse(serverResponse.target.responseText);
      if (response.status === 'OK') {
        errorDisplay.style.display = 'none';
        button.innerHTML = successText;
        button.disabled = false;
      } else {
        errorDisplay.style.display = 'block';
        errorDisplay.innerHTML = response.errors.join('<br>');
        button.disabled = false;
        button.innerHTML = text;
      }
    });
    request.open(method, url);
    // urlencode the FormData
    request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    request.send([...formData.entries()].map(e => `${encodeURIComponent(e[0])}=${encodeURIComponent(e[1])}`).join('&'));
  });
};
