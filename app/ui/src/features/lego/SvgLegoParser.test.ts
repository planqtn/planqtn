import { SvgLegoParser, SvgLegoData } from "./SvgLegoParser";

describe("SvgLegoParser", () => {
  it("should create leg styles from SVG data", () => {
    const mockSvgData: SvgLegoData = {
      body: {
        element:
          '<g data-role="lego-body"><rect x="-25" y="-25" width="50" height="50"/></g>',
        attributes: {}
      },
      text: {
        shortName: { x: 0, y: -6, content: "T6" },
        instanceId: { x: 0, y: 6, content: "1" }
      },
      legs: [
        {
          index: 0,
          type: "physical",
          startX: 0,
          startY: 0,
          endX: 0,
          endY: -40,
          labelX: 0,
          labelY: -55,
          lineStyle: "solid",
          width: "1px",
          bodyOrder: "front"
        },
        {
          index: 1,
          type: "logical",
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 40,
          labelX: 0,
          labelY: 55,
          lineStyle: "solid",
          width: "1px",
          bodyOrder: "front"
        }
      ],
      colors: {
        background: "#FFFFFF",
        border: "#4299E1",
        selectedBackground: "#3182CE",
        selectedBorder: "#2B6CB0"
      }
    };

    const legStyles = SvgLegoParser.createLegStylesFromSvgData(mockSvgData);

    expect(legStyles).toHaveLength(2);
    expect(legStyles[0].type).toBe("physical");
    expect(legStyles[1].type).toBe("logical");
    expect(legStyles[0].position.endX).toBe(0);
    expect(legStyles[0].position.endY).toBe(-40);
    expect(legStyles[1].position.endX).toBe(0);
    expect(legStyles[1].position.endY).toBe(40);
  });

  it("should validate SvgLegoData structure", () => {
    const mockSvgData: SvgLegoData = {
      body: {
        element:
          '<rect data-role="lego-body" x="-25" y="-25" width="50" height="50"/>',
        attributes: { x: "-25", y: "-25", width: "50", height: "50" }
      },
      text: {
        shortName: { x: 0, y: -6, content: "T6" }
      },
      legs: [
        {
          index: 0,
          type: "physical",
          startX: 0,
          startY: 0,
          endX: 0,
          endY: -40,
          labelX: 0,
          labelY: -55,
          lineStyle: "solid",
          width: "1px",
          bodyOrder: "front"
        }
      ],
      colors: {
        background: "#FFFFFF",
        border: "#4299E1",
        selectedBackground: "#3182CE",
        selectedBorder: "#2B6CB0"
      }
    };

    expect(mockSvgData.body.element).toContain('data-role="lego-body"');
    expect(mockSvgData.text.shortName?.content).toBe("T6");
    expect(mockSvgData.legs[0].type).toBe("physical");
    expect(mockSvgData.legs[0].index).toBe(0);
  });
});
