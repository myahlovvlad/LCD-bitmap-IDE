export async function copyToClipboard(text: string): Promise<void> {
  const value = String(text ?? '');
  if (window.spectroDesigner?.clipboardWrite) {
    await window.spectroDesigner.clipboardWrite(value);
    return;
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const element = document.createElement('textarea');
  element.value = value;
  element.setAttribute('readonly', 'true');
  element.style.position = 'fixed';
  element.style.left = '-9999px';
  document.body.appendChild(element);
  element.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(element);
  }
}
