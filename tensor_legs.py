class TensorLegs:
    def __init__(self, num_legs, legs=None):
        self.num_legs = (
            num_legs if legs is None else sum(leg is not None for leg in legs)
        )
        self.legs = list(range(num_legs)) if legs is None else legs

    def conjoin(self, other, legs1, legs2):
        if self.num_legs < len(self.legs) or other.num_legs < len(other.legs):
            raise ValueError("can't conjoin previously conjoined tensors yet")
        assert len(legs1) == len(legs2)
        new_legs = [leg if leg not in legs1 else None for leg in self.legs] + [
            self.num_legs + leg if leg is not None and leg not in legs2 else None
            for leg in other.legs
        ]
        return TensorLegs(-1, new_legs)

    def __getitem__(self, idx):
        return self.legs[idx]
