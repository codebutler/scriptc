class LocalCounter {
  constructor(value) { this.value = value + 1; }
  static create(value) { return new LocalCounter(value); }
}
export { LocalCounter as Counter };
