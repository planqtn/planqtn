import { GF2 } from "./GF2";
import { conjoin, self_trace, tensor_product } from "./parity_check";
import { TensorNetworkLeg } from "./TensorNetwork";

export class StabilizerCodeTensor {
  public constructor(
    public readonly h: GF2,
    public readonly idx: string,
    public readonly legs: TensorNetworkLeg[] = []
  ) {
    if (this.legs.length !== this.h.shape[1] / 2) {
      throw new Error(
        `Number of legs doesn't match number of legs in parity check matrix: ${this.legs.length} !== ${this.h.shape[1] / 2}`
      );
    }
  }

  get n(): number {
    return this.h.shape[1] / 2;
  }

  private removeLeg(
    legToCol: Map<string, number>,
    leg: TensorNetworkLeg
  ): void {
    legToCol.delete(`${leg.instanceId}:${leg.legIndex}`);
    legToCol.forEach((value, key) => {
      if (value > leg.legIndex) {
        legToCol.set(key, value - 1);
      }
    });
  }
  private removeLegs(
    legToCol: Map<string, number>,
    legs: TensorNetworkLeg[]
  ): void {
    // Remove legs from the mapping
    legs.forEach((leg) => this.removeLeg(legToCol, leg));
  }

  public conjoin(
    other: StabilizerCodeTensor,
    legs1: TensorNetworkLeg[],
    legs2: TensorNetworkLeg[]
  ): StabilizerCodeTensor {
    if (this.idx === other.idx) {
      return this.selfTrace(legs1, legs2);
    }

    if (legs1.length !== legs2.length) {
      throw new Error("Number of legs must match for conjoin operation");
    }

    // Create a new leg to column mapping that includes both tensors
    const conjoinedLegToCol = new Map(
      this.legs.map((leg, i) => [`${leg.instanceId}:${leg.legIndex}`, i])
    );
    other.legs.forEach((leg, i) => {
      conjoinedLegToCol.set(`${leg.instanceId}:${leg.legIndex}`, this.n + i);
    });

    const otherLegToCol = new Map(
      other.legs.map((leg, i) => [`${leg.instanceId}:${leg.legIndex}`, i])
    );

    // Perform initial conjoin
    let newH = conjoin(
      this.h,
      other.h,
      conjoinedLegToCol.get(`${legs1[0].instanceId}:${legs1[0].legIndex}`)!,
      otherLegToCol.get(`${legs2[0].instanceId}:${legs2[0].legIndex}`)!
    );

    // Remove the first pair of legs
    this.removeLegs(conjoinedLegToCol, [legs1[0], legs2[0]]);

    // Process remaining leg pairs
    for (let i = 1; i < legs1.length; i++) {
      newH = self_trace(
        newH,
        conjoinedLegToCol.get(`${legs1[i].instanceId}:${legs1[i].legIndex}`)!,
        conjoinedLegToCol.get(`${legs2[i].instanceId}:${legs2[i].legIndex}`)!
      );
      this.removeLegs(conjoinedLegToCol, [legs1[i], legs2[i]]);
    }

    // Combine remaining legs
    const newLegs = [
      ...this.legs.filter(
        (leg) =>
          !legs1.some(
            (l) =>
              l.instanceId === leg.instanceId && l.legIndex === leg.legIndex
          )
      ),
      ...other.legs.filter(
        (leg) =>
          !legs2.some(
            (l) =>
              l.instanceId === leg.instanceId && l.legIndex === leg.legIndex
          )
      )
    ];

    return new StabilizerCodeTensor(newH, this.idx, newLegs);
  }

  public selfTrace(
    legs1: TensorNetworkLeg[],
    legs2: TensorNetworkLeg[]
  ): StabilizerCodeTensor {
    if (legs1.length !== legs2.length) {
      throw new Error("Number of legs must match for self trace operation");
    }

    const legToCol = new Map(
      this.legs.map((leg, i) => [`${leg.instanceId}:${leg.legIndex}`, i])
    );

    let newH = this.h;
    for (let i = 0; i < legs1.length; i++) {
      newH = self_trace(
        newH,
        legToCol.get(`${legs1[i].instanceId}:${legs1[i].legIndex}`)!,
        legToCol.get(`${legs2[i].instanceId}:${legs2[i].legIndex}`)!
      );
    }
    this.removeLegs(legToCol, [...legs1, ...legs2]);

    return new StabilizerCodeTensor(
      newH,
      this.idx,
      this.legs.filter(
        (leg) =>
          ![...legs1, ...legs2].some(
            (l) =>
              l.instanceId === leg.instanceId && l.legIndex === leg.legIndex
          )
      )
    );
  }

  public tensorWith(other: StabilizerCodeTensor): StabilizerCodeTensor {
    // Create new legs by offsetting other's legs
    const newLegs = [
      ...this.legs,
      ...other.legs.map((leg) => ({
        instanceId: leg.instanceId,
        legIndex: leg.legIndex + this.n
      }))
    ];

    return new StabilizerCodeTensor(
      tensor_product(this.h, other.h),
      this.idx,
      newLegs
    );
  }
}
