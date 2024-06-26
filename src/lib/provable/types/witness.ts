import type { Field } from '../field.js';
import type { FlexibleProvable, InferProvable } from './struct.js';
import type { Provable } from './provable-intf.js';
import {
  inCheckedComputation,
  snarkContext,
} from '../core/provable-context.js';
import { exists, existsAsync } from '../core/exists.js';
import { From } from '../../../bindings/lib/provable-generic.js';

export { witness, witnessAsync };

function witness<A extends Provable<any, any>, T extends From<A> = From<A>>(
  type: A,
  compute: () => T
): InferProvable<A> {
  type S = InferProvable<A>;
  let ctx = snarkContext.get();

  // outside provable code, we just call the callback and return its cloned result
  if (!inCheckedComputation() || ctx.inWitnessBlock) {
    return clone(type, type.fromValue(compute()));
  }
  let proverValue: S | undefined = undefined;
  let fields: Field[];

  let id = snarkContext.enter({ ...ctx, inWitnessBlock: true });
  try {
    fields = exists(type.sizeInFields(), () => {
      proverValue = type.fromValue(compute());
      let fields = type.toFields(proverValue);
      return fields.map((x) => x.toBigInt());
    });
  } finally {
    snarkContext.leave(id);
  }

  // rebuild the value from its fields (which are now variables) and aux data
  let aux = type.toAuxiliary(proverValue);
  let value = (type as Provable<S>).fromFields(fields, aux);

  // add type-specific constraints
  type.check(value);

  return value;
}

async function witnessAsync<
  T,
  S extends FlexibleProvable<T> = FlexibleProvable<T>
>(type: S, compute: () => Promise<T>): Promise<T> {
  let ctx = snarkContext.get();

  // outside provable code, we just call the callback and return its cloned result
  if (!inCheckedComputation() || ctx.inWitnessBlock) {
    let value: T = await compute();
    return clone(type, value);
  }
  let proverValue: T | undefined = undefined;
  let fields: Field[];

  // call into `existsAsync` to witness the raw field elements
  let id = snarkContext.enter({ ...ctx, inWitnessBlock: true });
  try {
    fields = await existsAsync(type.sizeInFields(), async () => {
      proverValue = await compute();
      let fields = type.toFields(proverValue);
      return fields.map((x) => x.toBigInt());
    });
  } finally {
    snarkContext.leave(id);
  }

  // rebuild the value from its fields (which are now variables) and aux data
  let aux = type.toAuxiliary(proverValue);
  let value = (type as Provable<T>).fromFields(fields, aux);

  // add type-specific constraints
  type.check(value);

  return value;
}

function clone<T, S extends FlexibleProvable<T>>(type: S, value: T): T {
  let fields = type.toFields(value);
  let aux = type.toAuxiliary?.(value) ?? [];
  return (type as Provable<T>).fromFields(fields, aux);
}
