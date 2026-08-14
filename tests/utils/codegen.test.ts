import { describe, expect, it } from "vitest";
import {
  EMBEDDED_FORMAT_EXTENSIONS,
  exportScreenEmbedded,
  generateAllScreensBinary,
  generateAllScreensCHeader,
  generateScreenBinary,
  generateScreenCArray,
  parseCHeaderScreenArrays,
  sanitizeSymbolName,
} from "../../src/renderer/utils/codegen";
import type { CanvasData, CanvasObject } from "../../src/renderer/types/domain";
import { ExportEngine } from "../../src/renderer/core/ExportEngine";

const objects: CanvasObject[] = [
  {
    id: "line-1",
    type: "line",
    x0: 0,
    y0: 0,
    x1: 127,
    y1: 63,
    zIndex: 0,
    visible: true,
    locked: false,
    source: "user",
  },
];

describe("codegen utils", () => {
  it("sanitizes C identifiers", () => {
    expect(sanitizeSymbolName("screen parameters")).toBe("screen_parameters");
    expect(sanitizeSymbolName("1-screen")).toBe("_1_screen");
  });

  it("exports a selected screen as a 1024-byte C array and bin", () => {
    const cCode = generateScreenCArray(objects, {
      symbolName: "state one",
      language: "en",
    });
    expect(cCode).toContain("static const uint8_t state_one[1024]");
    expect(generateScreenBinary(objects, "en")).toHaveLength(1024);
  });

  it("exports all screens in state order", () => {
    const canvases: CanvasData[] = [
      makeCanvas("state-a"),
      makeCanvas("state-b"),
    ];
    const header = generateAllScreensCHeader(canvases, {
      projectSymbolName: "project",
      language: "en",
    });
    expect(header.indexOf("project_state_a_screen")).toBeLessThan(
      header.indexOf("project_state_b_screen"),
    );
    expect(generateAllScreensBinary(canvases, "en")).toHaveLength(2048);
  });

  it("uses each screen's actual byte length in mixed-resolution C tables", () => {
    const canvases: CanvasData[] = [
      makeCanvas("small", 16, 16),
      makeCanvas("banner", 24, 9),
    ];
    const header = generateAllScreensCHeader(canvases, {
      projectSymbolName: "project",
      language: "en",
    });

    expect(header).toContain("static const uint8_t project_small_screen[32]");
    expect(header).toContain('{ "small", project_small_screen, 32 }');
    expect(header).toContain("static const uint8_t project_banner_screen[48]");
    expect(header).toContain('{ "banner", project_banner_screen, 48 }');
    expect(generateAllScreensBinary(canvases, "en")).toHaveLength(80);
  });

  it("imports C header literals in hex, decimal, and binary forms", () => {
    const values = ["0x01", "2", "0b00000011", ...new Array(1021).fill("0x00")];
    const arrays = parseCHeaderScreenArrays(
      `static const uint8_t imported_screen[1024] = { ${values.join(", ")} };`,
    );
    expect(arrays[0].bytes.slice(0, 3)).toEqual([1, 2, 3]);
  });

  it("reports invalid screen byte counts", () => {
    expect(() =>
      parseCHeaderScreenArrays("static const uint8_t bad[2] = { 0x00, 0x01 };"),
    ).toThrow(/1024/);
  });

  it("exposes the complete export engine facade", () => {
    const engine = new ExportEngine();
    const canvases = [makeCanvas("state-a")];
    expect(engine.generateBytesFromObjects(objects, "en")).toHaveLength(1024);
    expect(
      engine.generateCCode(objects, { symbolName: "screen", language: "en" }),
    ).toContain("screen[1024]");
    expect(engine.generateBinary(objects, "en")).toHaveLength(1024);
    expect(
      engine.generateAllScreensCHeader(canvases, {
        projectSymbolName: "project",
        language: "en",
      }),
    ).toContain("PROJECT_SCREEN_COUNT 1");
    expect(engine.generateAllScreensBinary(canvases, "en")).toHaveLength(1024);
    const packed = engine.packFrameBuffer([[true]]);
    expect(packed).toHaveLength(1024);
    expect(packed[0]).toBe(1);
  });

  it("exports every embedded firmware format from the same screen model", () => {
    const formats = Object.keys(EMBEDDED_FORMAT_EXTENSIONS) as Array<
      keyof typeof EMBEDDED_FORMAT_EXTENSIONS
    >;
    const results = new Map(
      formats.map((format) => [
        format,
        exportScreenEmbedded(objects, format, {
          symbolName: "status screen",
          language: "en",
          width: 8,
          height: 8,
          bytesPerRow: 4,
        }),
      ]),
    );

    expect(results.get("binary")).toBeInstanceOf(Uint8Array);
    expect(results.get("binary")).toHaveLength(8);
    expect(results.get("c-vertical-lsb")).toContain("status_screen[8]");
    expect(results.get("c-horizontal-msb")).toContain("status_screen[8]");
    expect(results.get("c-horizontal-lsb")).toContain("status_screen[8]");
    expect(results.get("xbm")).toContain("#define status_screen_width 8");
    expect(results.get("arduino-progmem")).toContain(
      "PROGMEM status_screen[8]",
    );
    expect(results.get("rust-embedded")).toContain(
      "pub const STATUS_SCREEN: [u8; 8]",
    );
    expect(results.get("rust-embedded")).toContain(
      "1bpp row-major MSB, each row byte-aligned",
    );
    expect(results.get("rust-embedded")).toContain(
      "let img = Image::new(&raw, Point::zero());",
    );
    expect(results.get("esp-idf")).toContain(
      "RODATA_ATTR uint8_t status_screen[8]",
    );
  });

  it("packs Rust ImageRaw pixels row-major and MSB-first", () => {
    const diagonal: CanvasObject[] = [{
      ...objects[0],
      x1: 7,
      y1: 7,
    }];

    const rust = exportScreenEmbedded(diagonal, "rust-embedded", {
      symbolName: "diagonal",
      language: "en",
      width: 8,
      height: 8,
      bytesPerRow: 8,
    });

    expect(rust).toContain(
      "0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01",
    );
  });
});

function makeCanvas(stateId: string, width = 128, height = 64): CanvasData {
  return {
    stateId,
    width,
    height,
    objects,
    selectedObjectIds: [],
    updatedAt: "2026-05-12T00:00:00.000Z",
  };
}
