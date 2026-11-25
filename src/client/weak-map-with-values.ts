/**
 * Vendored WeakMapWithValues (from @deepseek-ai/dsh-util-values) so the
 * standalone client bundle needs no extra runtime module. Keep in sync with
 * the installed DSH when upgrading.
 */
export class WeakMapWithValues<Key extends object, Value> {
  private keys = new WeakMap<Key, Value>()
  private readonly valueSet = new Set<Value>()
  /** Live strongly retained values in insertion order. */
  readonly values: ReadonlySet<Value> = this.valueSet

  /** Read the value associated with a key. */
  get(key: Key): Value | undefined {
    return this.keys.get(key)
  }

  /** Test whether a key has an association. */
  has(key: Key): boolean {
    return this.keys.has(key)
  }

  /** Associate one key with one caller-unique value. */
  set(key: Key, value: Value): this {
    if (this.keys.has(key)) {
      const previous = this.keys.get(key) as Value
      if (previous === value) return this
      this.valueSet.delete(previous)
    }
    this.keys.set(key, value)
    this.valueSet.add(value)
    return this
  }

  /** Remove one association and its strongly retained value. */
  delete(key: Key): boolean {
    if (!this.keys.has(key)) return false
    const value = this.keys.get(key) as Value
    const deleted = this.keys.delete(key)
    this.valueSet.delete(value)
    return deleted
  }

  /** Remove every association and strongly retained value. */
  clear(): void {
    this.keys = new WeakMap()
    this.valueSet.clear()
  }
}
