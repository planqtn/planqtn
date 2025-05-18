import { GF2 } from "./GF2";
import { conjoin, self_trace, tensor_product } from "./parity_check";
import { TensorNetworkLeg } from "./TensorNetwork";

export class StabilizerCodeTensor {
  public legToCol: Map<string, number>;

  public constructor(
    public readonly h: GF2,
    public readonly idx: string,
    public legs: TensorNetworkLeg[] = [],
  ) {
    // Initialize leg to column mapping
    this.legToCol = new Map(
      legs.map((leg, i) => [`${leg.instanceId}:${leg.legIndex}`, i]),
    );

    if (this.legs.length !== this.h.shape[1] / 2) {
      throw new Error(
        `Number of legs doesn't match number of legs in parity check matrix: ${this.legs.length} !== ${this.h.shape[1] / 2}`,
      );
    }
  }

  get n(): number {
    return this.h.shape[1] / 2;
  }

  private removeLegs(legs: TensorNetworkLeg[]): void {
    // Remove legs from the mapping
    legs.forEach((leg) =>
      this.legToCol.delete(`${leg.instanceId}:${leg.legIndex}`),
    );

    // Reindex remaining legs
    const remainingLegs = Array.from(this.legToCol.keys()).sort();
    this.legToCol = new Map(remainingLegs.map((key, i) => [key, i]));

    // Remove legs from the legs array
    this.legs = this.legs.filter(
      (leg) =>
        !legs.some(
          (l) => l.instanceId === leg.instanceId && l.legIndex === leg.legIndex,
        ),
    );
  }

  public conjoin(
    other: StabilizerCodeTensor,
    legs1: TensorNetworkLeg[],
    legs2: TensorNetworkLeg[],
  ): StabilizerCodeTensor {
    if (this.idx === other.idx) {
      return this.selfTrace(legs1, legs2);
    }

    if (legs1.length !== legs2.length) {
      throw new Error("Number of legs must match for conjoin operation");
    }

    // Create a new leg to column mapping that includes both tensors
    const newLegToCol = new Map(this.legToCol);
    other.legs.forEach((leg, i) => {
      newLegToCol.set(`${leg.instanceId}:${leg.legIndex}`, this.n + i);
    });

    // Perform initial conjoin
    let newH = conjoin(
      this.h,
      other.h,
      this.legToCol.get(`${legs1[0].instanceId}:${legs1[0].legIndex}`)!,
      other.legToCol.get(`${legs2[0].instanceId}:${legs2[0].legIndex}`)!,
    );

    // Remove the first pair of legs
    this.removeLegs([legs1[0]]);
    other.removeLegs([legs2[0]]);

    // Process remaining leg pairs
    for (let i = 1; i < legs1.length; i++) {
      newH = self_trace(
        newH,
        newLegToCol.get(`${legs1[i].instanceId}:${legs1[i].legIndex}`)!,
        newLegToCol.get(`${legs2[i].instanceId}:${legs2[i].legIndex}`)!,
      );
      this.removeLegs([legs1[i]]);
      other.removeLegs([legs2[i]]);
    }

    // Combine remaining legs
    const newLegs = [
      ...this.legs.filter(
        (leg) =>
          !legs1.some(
            (l) =>
              l.instanceId === leg.instanceId && l.legIndex === leg.legIndex,
          ),
      ),
      ...other.legs.filter(
        (leg) =>
          !legs2.some(
            (l) =>
              l.instanceId === leg.instanceId && l.legIndex === leg.legIndex,
          ),
      ),
    ];

    return new StabilizerCodeTensor(newH, this.idx, newLegs);
  }

  public selfTrace(
    legs1: TensorNetworkLeg[],
    legs2: TensorNetworkLeg[],
  ): StabilizerCodeTensor {
    if (legs1.length !== legs2.length) {
      throw new Error("Number of legs must match for self trace operation");
    }

    let newH = this.h;
    for (let i = 0; i < legs1.length; i++) {
      console.log(
        `self tracing ${legs1[i].legIndex} ${legs2[i].legIndex}`,
        this.legToCol.get(`${legs1[i].instanceId}:${legs1[i].legIndex}`)!,
        this.legToCol.get(`${legs2[i].instanceId}:${legs2[i].legIndex}`)!,
      );
      newH = self_trace(
        newH,
        this.legToCol.get(`${legs1[i].instanceId}:${legs1[i].legIndex}`)!,
        this.legToCol.get(`${legs2[i].instanceId}:${legs2[i].legIndex}`)!,
      );
    }

    // Remove traced legs
    this.removeLegs([...legs1, ...legs2]);

    return new StabilizerCodeTensor(newH, this.idx, this.legs);
  }

  public tensorWith(other: StabilizerCodeTensor): StabilizerCodeTensor {
    // Create new legs by offsetting other's legs
    const newLegs = [
      ...this.legs,
      ...other.legs.map((leg) => ({
        instanceId: leg.instanceId,
        legIndex: leg.legIndex + this.n,
      })),
    ];

    return new StabilizerCodeTensor(
      tensor_product(this.h, other.h),
      this.idx,
      newLegs,
    );
  }
}
