import { Group } from '../wrapped.js';
import { test, Random } from '../../testing/property.js';
import { Provable } from '../provable.js';
import { Poseidon } from '../../../mina-signer/src/poseidon-bigint.js';
import { runAndCheckSync } from '../core/provable-context.js';
import { scale } from '../gadgets/scalar.js';
import { Field } from '../field.js';

console.log('group consistency tests');

test(Random.field, Random.field, (a, s0, assert) => {
  const {
    x: x1,
    y: { x0: y1 },
  } = Poseidon.hashToGroup([a])!;
  const g = Group.from(x1, y1);
  const s = Field.from(s0);

  runScale(g, s, (g, s) => scale(g, s), assert);
});

// tests consistency between in- and out-circuit implementations
test(Random.field, Random.field, (a, b, assert) => {
  const {
    x: x1,
    y: { x0: y1 },
  } = Poseidon.hashToGroup([a])!;

  const {
    x: x2,
    y: { x0: y2 },
  } = Poseidon.hashToGroup([b])!;

  const zero = Group.zero;
  const g1 = Group.from(x1, y1);
  const g2 = Group.from(x2, y2);

  run(g1, g2, (x, y) => x.add(y), assert);
  run(g1.neg(), g2.neg(), (x, y) => x.add(y), assert);
  run(g1, g1.neg(), (x, y) => x.add(y), assert);
  run(g1, zero, (x, y) => x.add(y), assert);
  run(g1, zero.neg(), (x, y) => x.add(y), assert);
  run(g1.neg(), zero, (x, y) => x.add(y), assert);

  run(zero, zero, (x, y) => x.add(y), assert);
  run(zero, zero.neg(), (x, y) => x.add(y), assert);
  run(zero.neg(), zero, (x, y) => x.add(y), assert);
  run(zero.neg(), zero.neg(), (x, y) => x.add(y), assert);

  run(g1, g2, (x, y) => x.sub(y), assert);
  run(g1.neg(), g2.neg(), (x, y) => x.sub(y), assert);
  run(g1, g1.neg(), (x, y) => x.sub(y), assert);
  run(g1, zero, (x, y) => x.sub(y), assert);
  run(g1, zero.neg(), (x, y) => x.sub(y), assert);
  run(g1.neg(), zero, (x, y) => x.sub(y), assert);

  run(zero, zero, (x, y) => x.sub(y), assert);
  run(zero, zero.neg(), (x, y) => x.sub(y), assert);
  run(zero.neg(), zero, (x, y) => x.sub(y), assert);
  run(zero.neg(), zero.neg(), (x, y) => x.sub(y), assert);
});

function run(
  g1: Group,
  g2: Group,
  f: (g1: Group, g2: Group) => Group,
  assert: (b: boolean, message?: string | undefined) => void
) {
  let result_out_circuit = f(g1, g2);

  runAndCheckSync(() => {
    let result_in_circuit = f(
      Provable.witness(Group, () => g1),
      Provable.witness(Group, () => g2)
    );

    Provable.asProver(() => {
      assert(
        result_out_circuit.equals(result_in_circuit).toBoolean(),
        `Result for x does not match. g1: ${JSON.stringify(
          g1
        )}, g2: ${JSON.stringify(g2)}`
      );
    });
  });
}

function runScale(
  g: Group,
  s: Field,
  f: (g1: Group, s: Field) => Group,
  assert: (b: boolean, message?: string | undefined) => void
) {
  let result_out_circuit = f(g, s);

  runAndCheckSync(() => {
    let result_in_circuit = f(
      Provable.witness(Group, () => g),
      Provable.witness(Field, () => s)
    );

    Provable.asProver(() => {
      assert(
        result_out_circuit.equals(result_in_circuit).toBoolean(),
        `Result for x does not match. g: ${JSON.stringify(
          g
        )}, s: ${JSON.stringify(s)}
        
        out_circuit: ${JSON.stringify(result_out_circuit)}
        in_circuit: ${JSON.stringify(result_in_circuit)}`
      );
    });
  });
}
