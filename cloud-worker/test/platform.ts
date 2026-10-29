/** Node-only platform base; concurrency/storage semantics are tested separately in workerd. */
export class DurableObject<E> {
  constructor(protected ctx: DurableObjectState, protected env: E) {}
}
