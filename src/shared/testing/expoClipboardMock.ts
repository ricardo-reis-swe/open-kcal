let clipboardText = '';

export const getStringAsync = jest.fn(async () => clipboardText);
export const setStringAsync = jest.fn(async (value: string) => {
  clipboardText = value;
});
export const __setClipboardText = (value: string) => {
  clipboardText = value;
};
export const __clearClipboard = () => {
  clipboardText = '';
};
