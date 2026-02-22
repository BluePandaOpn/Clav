chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "AUTOFILL_CREDENTIAL") return false;

  try {
    const credential = message.credential || {};
    const result = autofillCredential(credential);
    sendResponse({ ok: true, ...result });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }

  return true;
});

function autofillCredential(credential) {
  const forms = Array.from(document.forms || []);
  const targetForm = forms.find(hasPasswordField);

  const scope = targetForm || document;
  const passwordInput = findPasswordField(scope);
  if (!passwordInput) {
    throw new Error("No se encontro campo de password en la pagina.");
  }

  const usernameInput = findUsernameField(scope);

  if (usernameInput && credential.username) {
    setNativeValue(usernameInput, credential.username);
  }

  setNativeValue(passwordInput, credential.password || "");

  passwordInput.focus();
  passwordInput.dispatchEvent(new Event("blur", { bubbles: true }));

  return {
    filled: true,
    formDetected: Boolean(targetForm),
    usernameFilled: Boolean(usernameInput && credential.username)
  };
}

function hasPasswordField(form) {
  return Boolean(form?.querySelector?.("input[type='password']"));
}

function findPasswordField(scope) {
  return (
    scope.querySelector("input[type='password']:not([disabled]):not([readonly])") ||
    scope.querySelector("input[autocomplete='current-password']") ||
    null
  );
}

function findUsernameField(scope) {
  const selectors = [
    "input[autocomplete='username']",
    "input[type='email']",
    "input[name*='user' i]",
    "input[name*='login' i]",
    "input[id*='user' i]",
    "input[id*='email' i]",
    "input[type='text']"
  ];

  for (const selector of selectors) {
    const node = scope.querySelector(selector);
    if (!node) continue;
    if (node.disabled || node.readOnly) continue;
    return node;
  }

  return null;
}

function setNativeValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
