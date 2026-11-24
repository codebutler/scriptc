let current = 0;
export const Mode = {
  get First() {
    console.log("read");
    return current;
  },
  Second: 1,
};
export function setCurrent(value) {
  current = value;
}
