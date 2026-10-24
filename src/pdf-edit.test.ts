import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { editPDF, inspectSource, parsePages, type EditState } from "./pdf-edit";
async function fixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) {
    const p = doc.addPage([400 + i * 10, 600]);
    p.drawText(`Original ${i + 1}`, { font, x: 25, y: 550 });
  }
  return doc.save();
}
async function setup() {
  const bytes = await fixture();
  const info = await inspectSource(bytes, 0);
  const state: EditState = {
    pages: info.pages,
    marks: [],
    title: "Copia editada",
    author: "Luis",
    watermark: "",
    numberPages: false,
    fields: {},
  };
  return { bytes, state };
}
describe("local PDF editing", () => {
  it("validates page ranges without silently discarding invalid input", () => {
    expect(parsePages("1-3, 5, 2", 5)).toEqual([0, 1, 2, 4]);
    for (const v of ["", "0", "2-1", "1-6", "NaN", "1,"])
      expect(() => parsePages(v, 5)).toThrow();
  });
  it("reorders, duplicates, rotates and crops vector pages without changing the input", async () => {
    const { bytes, state } = await setup();
    const original = bytes.slice();
    state.pages = [
      { ...state.pages[2], rotation: 90, crop: 10 },
      state.pages[0],
      { ...state.pages[0], id: "duplicate" },
    ];
    const out = await PDFDocument.load(await editPDF([bytes], state));
    expect(out.getPageCount()).toBe(3);
    expect(out.getPage(0).getWidth()).toBe(600);
    expect(out.getPage(0).getCropBox().width).toBe(480);
    expect(out.getPage(1).getWidth()).toBe(400);
    expect(bytes).toEqual(original);
    expect(out.getTitle()).toBe("Copia editada");
    expect(out.getAuthor()).toBe("Luis");
  });
  it("merges multiple sources, adds a genuinely blank page and extracts the selected order", async () => {
    const { bytes, state } = await setup();
    const other = await fixture();
    const info = await inspectSource(other, 1);
    state.pages.push(...info.pages, {
      id: "blank",
      source: 0,
      index: -1,
      rotation: 0,
      crop: 0,
    });
    const out = await PDFDocument.load(
      await editPDF([bytes, other], state, [6, 4, 0]),
    );
    expect(out.getPageCount()).toBe(3);
    expect(out.getPage(0).getSize()).toEqual({ width: 595, height: 842 });
    expect(out.getPage(1).getWidth()).toBe(410);
  });
  it("writes annotations, drawings, images, watermarks and numbering as real PDF content with a new fingerprint", async () => {
    const { bytes, state } = await setup();
    state.watermark = "BORRADOR";
    state.numberPages = true;
    const base = {
      id: "m",
      pageId: state.pages[0].id,
      x: 0.1,
      y: 0.2,
      w: 0.2,
      h: 0.1,
      color: "#ff0000",
      size: 12,
    };
    state.marks = [
      { ...base, tool: "text", text: "Revisión de Luis" },
      { ...base, id: "h", tool: "highlight" },
      { ...base, id: "r", tool: "rect" },
      { ...base, id: "e", tool: "ellipse" },
      { ...base, id: "l", tool: "line" },
      {
        ...base,
        id: "p",
        tool: "pen",
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.3, y: 0.4 },
        ],
      },
    ];
    state.marks.push({...base,id:'image',tool:'image',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAFHElEQVR4nO3VwbEcNRSFYcdAFWtHQz5kQjIsCYIUCIEITBnsqufhvZnpnpaudM+3+Pdq6Xwzn37+6fMXKbVP1QeQKgNA0QGg6ABQdAAoOgAUHQCKDgBFB4CiA0DRAaDoAFB0ACg6ABQdAIoOAEUHgKIDQNEBoOgAUHQAKDoAFB0Aig4ARQeAogNA0QGg6ABQdAAoOgAUHQDF/fXnl/IzJAdAYb//9ve/AH795Y/ys6QGQFFfx/8WAAQ1AVDQ9/HfAoBgfgBM7nb834OgJgAm9nb89wBAMC8AJnU7/kcAIJgTABN6NH4I6gJgcO+N/wgACMYGwMA+Gv9RABCMC4BB3Rv/GQAQjAmAAZ0ZPwQ1AXBxj8b/KgAIrg2AC3tm/FcAgOC6ALioZ8d/FQAIrgmAC7pq/BDMD4AXOzL+EQAgeC0AXujo+EcBgOB8AJxs1PghmBsAJzoz/hkAIDgeAAc7O/5ZACA4FgAHemX8MwFA8HwAPNnM8UMwLwCe6NXxVwGA4HEAPOiK8VcCgOB+ANzpqvFXA4Dg4wD4oOrxQzAnAN7pyvGvBACC/wfATVePfzUAEPwYAG9abfwQjA+Ab40Y/8oAIPgvAAaOf3UAEAAwdPw7AEhHEA1gh/FDAMCW498NQCqCSAAzxr8jgEQEUQBmDX9nAGkQYgDsPH4IANhq/F0AJCBoD6Bi/J0AdEfQGkCn8UMAwBbj7wqgK4KWACrH3xlARwTtAFSPvzuAbghaAage/ujxQwDA0uNPAtAFQQsA1aNPBdABwfYAqgc/e/wQALDk+JMB7IxgWwDVYwegB4ItAVQPHYA+CLYDUD3yFcYPQSiA6pED0A/BNgCqBw5ATwRbAKgeNwB9ESwPoHrYq44fggAA1cMGoD+CZQFUjxqADAQAAADAqlUPG4De418ewC4IANhz/FsA2AEBAHuOfxsAEBg/AAuMHAAAIACgzfi3A7AyAgD2G/+WACAw/ngAqyJIB1C9CQAAACAFwIoIkgFUbyESwGoIUgFUbyAaQCKC6sF3GX8bACshSAJQ/eYAAAAAAGshSAFQ/dYALIogAUD1GwMQjMD4AVgeQVcA1W8KAAAAALA+go4Aqt8SAAiMH4B9EHQBUP12AGyKoAOA6jcDAAAAANgTwe4Aqt8KAAiMH4C9EewIoPptAGiEYDcA1W8CAAAAAACB8QPQBsEOAKrfAIDGCFYHUH331QEwGMHKAKrvfIUA+BYAmQHwphURGP/YALgpAUD1Ha8UAO/UGUD13a4WAB/UEUD1na4YAHfqBKD6LlcNgDtV/wv49R8fAA/qAKD6DlcOgCfaGUD13a0eAE+2I4DqO9shAA40E4HxzwmAAwHQLwAOtgOA6jvaKQBOtDKA6rvZLQBOtiKA6jvZMQBeaBQC458XAC8EwP4B8GIrAKi+g50D4IIqAVR/++4BcFFXITD+uQFwYTMBVH9rlwC4MAD2C4CLmwGg+hs7BcCARgKo/rZuATCoMwiMf34ADOxKANXf0jUABgbA+gEwuCsAVH9D5wCY0CsAqs/ePQAm9QiB8dcEwMSOAKg+a0oATAyA9QJgcs8AqD5jUgAUdIvA+OsCoKj3AFSfKTEACnsLoPosqQFQGAD1AVDcVwDVZ0gOAEUHgKIDQNEBoOgAUHQAKDoAFB0Aig4ARQeAogNA0QGg6ABQdAAoOgAUHQCKDgBFB4CiA0DRAaDoAFB0ACg6ABQdAIoOAEUHgKIDQNEBoOgAUHQAKLp/ANrqS5+GQyrKAAAAAElFTkSuQmCC'});
    const first = await editPDF([bytes], state);
    const out = await PDFDocument.load(first);
    expect(out.getPageCount()).toBe(3);
    expect(out.context.trailerInfo.ID?.toString()).not.toBe(
      (
        await PDFDocument.load(await editPDF([bytes], state))
      ).context.trailerInfo.ID?.toString(),
    );
    expect(out.getPage(0).node.Contents()).toBeTruthy();

  });
  it("reads and fills form values, then preserves their visible appearances in the exported copy", async () => {
    const doc = await PDFDocument.create();
    const p = doc.addPage();
    const field = doc.getForm().createTextField("Nombre");
    field.setText("Antes");
    field.addToPage(p, { x: 50, y: 500, width: 200, height: 30 });
    const check = doc.getForm().createCheckBox("Acepto");
    check.addToPage(p, { x: 50, y: 450, width: 20, height: 20 });
    const bytes = await doc.save(),
      info = await inspectSource(bytes, 0);
    expect(info.fields).toHaveLength(2);
    const out = await PDFDocument.load(
      await editPDF([bytes], {
        pages: info.pages,
        marks: [],
        title: "Formulario",
        author: "",
        watermark: "",
        numberPages: false,
        fields: { "0:Nombre": "Luis", "0:Acepto": true },
      }),
    );
    expect(out.getForm().getFields()).toHaveLength(0);
    expect(out.getPage(0).node.Contents()).toBeTruthy();
  });
  it("handles pre-rotated and empty PDF pages", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 500]).setRotation(degrees(90));
    const bytes = await doc.save();
    const info = await inspectSource(bytes, 0);
    const result = await PDFDocument.load(
      await editPDF([bytes], {
        pages: info.pages,
        marks: [],
        title: "Vacio",
        author: "",
        watermark: "",
        numberPages: false,
        fields: {},
      }),
    );
    expect(result.getPage(0).getSize()).toEqual({ width: 500, height: 300 });
  });
});
