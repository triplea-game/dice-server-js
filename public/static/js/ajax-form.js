const registerForm = (form, button, errorDisplay, method, url, text) => {
  form.addEventListener('submit', event => {
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
        button.innerHTML = '';
      } else {
        errorDisplay.style.display = 'block';
        errorDisplay.innerHTML = response.errors.join('<br>');
        button.disabled = false;
        button.innerHTML = text;
      }
    });
    request.open(method, url);
    request.send(formData);
  });
};
