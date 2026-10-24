import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  PDFHexString,
} from "pdf-lib";
export type Tool =
  | "select"
  | "text"
  | "highlight"
  | "rect"
  | "ellipse"
  | "line"
  | "pen"
  | "signature"
  | "image";
export type Point = { x: number; y: number };
export interface Mark {
  id: string;
  pageId: string;
  tool: Exclude<Tool, "select">;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  size: number;
  text?: string;
  points?: Point[];
  image?: string;
}
export interface Sheet {
  id: string;
  source: number;
  index: number;
  rotation: number;
  crop: number;
}
export interface EditState {
  pages: Sheet[];
  marks: Mark[];
  title: string;
  author: string;
  watermark: string;
  numberPages: boolean;
  fields: Record<string, string | boolean>;
}
export interface EditorDraft {
  extraSources: Uint8Array[];
  state: EditState;
}
export interface FormField {
  key: string;
  label: string;
  type: "text" | "check" | "select";
  value: string | boolean;
  options?: string[];
}
export const uid = () => crypto.randomUUID();
export function parsePages(value: string, total: number): number[] {
  const pages: number[] = [];
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw Error("Escribe páginas como 1-3, 5, 8.");
    const a = Number(match[1]),
      b = Number(match[2] || a);
    if (a < 1 || b > total || b < a)
      throw Error(`Usa páginas entre 1 y ${total}, con rangos ascendentes.`);
    for (let n = a; n <= b; n++) if (!pages.includes(n - 1)) pages.push(n - 1);
  }
  return pages;
}
export async function inspectSource(bytes: Uint8Array, source: number) {
  const doc = await PDFDocument.load(bytes);
  const fields: FormField[] = [];
  for (const field of doc.getForm().getFields()) {
    const key = `${source}:${field.getName()}`;
    if ("getText" in field)
      fields.push({
        key,
        label: field.getName(),
        type: "text",
        value: (field as import("pdf-lib").PDFTextField).getText() || "",
      });
    else if ("isChecked" in field)
      fields.push({
        key,
        label: field.getName(),
        type: "check",
        value: (field as import("pdf-lib").PDFCheckBox).isChecked(),
      });
    else if ("getOptions" in field && "select" in field) {
      const f = field as import("pdf-lib").PDFDropdown;
      fields.push({
        key,
        label: field.getName(),
        type: "select",
        value: f.getSelected()[0] || "",
        options: f.getOptions(),
      });
    }
  }
  return {
    pages: doc
      .getPages()
      .map((_, index) => ({ id: uid(), source, index, rotation: 0, crop: 0 })),
    fields,
  };
}
const color = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
export async function editPDF(
  sources: Uint8Array[],
  state: EditState,
  selection?: number[],
  decorate = true,
): Promise<Uint8Array> {
  if (!state.pages.length)
    throw Error("El PDF debe conservar al menos una página.");
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const docs = new Map<number, PDFDocument>();
  const images = new Map<
    string,
    Awaited<ReturnType<PDFDocument["embedPng"]>>
  >();
  const chosen = selection || state.pages.map((_, i) => i);
  for (const [outputIndex, index] of chosen.entries()) {
    if (outputIndex % 8 === 0)
      await new Promise((resolve) => setTimeout(resolve, 0));
    const sheet = state.pages[index];
    if (!sheet) throw Error("Página no válida.");
    if (!docs.has(sheet.source)) {
      const source = await PDFDocument.load(sources[sheet.source]);
      const form = source.getForm();
      for (const field of form.getFields()) {
        const val = state.fields[`${sheet.source}:${field.getName()}`];
        if (val !== undefined && "setText" in field)
          (field as import("pdf-lib").PDFTextField).setText(String(val));
        else if (typeof val === "boolean" && "check" in field) {
          const f = field as import("pdf-lib").PDFCheckBox;
          if (val) f.check();
          else f.uncheck();
        } else if (typeof val === "string" && "select" in field) {
          const dropdown = field as import("pdf-lib").PDFDropdown;
          if (val) dropdown.select(val);
          else dropdown.clear();
        }
      }
      if (form.getFields().length) form.flatten();
      docs.set(sheet.source, source);
    }
    const sourceDoc = docs.get(sheet.source)!;
    const original =
      sheet.index < 0
        ? sourceDoc.addPage([595, 842])
        : sourceDoc.getPage(sheet.index);
    const box = original.getCropBox();
    const embedded = original.node.Contents()
      ? await out.embedPage(original, {
          left: box.x,
          bottom: box.y,
          right: box.x + box.width,
          top: box.y + box.height,
        })
      : undefined;
    const rotation =
      (((original.getRotation().angle + sheet.rotation) % 360) + 360) % 360;
    const width = rotation % 180 ? box.height : box.width,
      height = rotation % 180 ? box.width : box.height;
    const page = out.addPage([width, height]);
    const transforms: Record<number, { x: number; y: number; angle: number }> =
      {
        0: { x: 0, y: 0, angle: 0 },
        90: { x: 0, y: box.width, angle: -90 },
        180: { x: box.width, y: box.height, angle: 180 },
        270: { x: box.height, y: 0, angle: 90 },
      };
    const transform = transforms[rotation];
    if (!transform)
      throw Error(
        "Rotación original no compatible: utiliza múltiplos de 90 grados.",
      );
    if (embedded)
      page.drawPage(embedded, {
        x: transform.x,
        y: transform.y,
        width: box.width,
        height: box.height,
        rotate: degrees(transform.angle),
      });
    const margin = sheet.crop / 100;
    const crop = {
      x: width * margin,
      y: height * margin,
      width: width * (1 - 2 * margin),
      height: height * (1 - 2 * margin),
    };
    page.setCropBox(crop.x, crop.y, crop.width, crop.height);
    if (decorate)
      for (const mark of state.marks.filter((m) => m.pageId === sheet.id)) {
        const x = crop.x + mark.x * crop.width,
          y = crop.y + (1 - mark.y) * crop.height,
          w = mark.w * crop.width,
          h = mark.h * crop.height;
        const ink = color(mark.color);
        const size = mark.size;
        if (mark.tool === "text")
          page.drawText(mark.text || "", {
            x,
            y: y - size,
            size,
            font,
            color: ink,
            lineHeight: size * 1.25,
          });
        else if (mark.tool === "image" && mark.image) {
          if (!images.has(mark.image))
            images.set(mark.image, await out.embedPng(mark.image));
          const image = images.get(mark.image)!;
          const scale = Math.min(w / image.width, h / image.height);
          const iw = image.width * scale,
            ih = image.height * scale;
          page.drawImage(image, { x, y: y - ih, width: iw, height: ih });
        } else if (mark.tool === "pen" || mark.tool === "signature") {
          const points = mark.points || [];
          for (let i = 1; i < points.length; i++)
            page.drawLine({
              start: {
                x: crop.x + points[i - 1].x * crop.width,
                y: crop.y + (1 - points[i - 1].y) * crop.height,
              },
              end: {
                x: crop.x + points[i].x * crop.width,
                y: crop.y + (1 - points[i].y) * crop.height,
              },
              thickness: size,
              color: ink,
            });
        } else if (mark.tool === "line")
          page.drawLine({
            start: {
              x: crop.x + (mark.points?.[0]?.x ?? mark.x) * crop.width,
              y: crop.y + (1 - (mark.points?.[0]?.y ?? mark.y)) * crop.height,
            },
            end: {
              x: crop.x + (mark.points?.[1]?.x ?? mark.x + mark.w) * crop.width,
              y:
                crop.y +
                (1 - (mark.points?.[1]?.y ?? mark.y + mark.h)) * crop.height,
            },
            thickness: size,
            color: ink,
          });
        else if (mark.tool === "ellipse")
          page.drawEllipse({
            x: x + w / 2,
            y: y - h / 2,
            xScale: w / 2,
            yScale: h / 2,
            borderWidth: size,
            borderColor: ink,
          });
        else
          page.drawRectangle({
            x,
            y: y - h,
            width: w,
            height: h,
            ...(mark.tool === "highlight"
              ? { color: ink, opacity: 0.3 }
              : { borderColor: ink, borderWidth: size }),
          });
      }
    if (decorate && state.watermark)
      page.drawText(state.watermark, {
        x: crop.x + crop.width * 0.12,
        y: crop.y + crop.height * 0.38,
        size: Math.min(
          44,
          (crop.width / Math.max(8, state.watermark.length)) * 1.3,
        ),
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.23,
        rotate: degrees(30),
      });
    if (decorate && state.numberPages)
      page.drawText(`${outputIndex + 1} / ${chosen.length}`, {
        x: crop.x + crop.width * 0.45,
        y: crop.y + 12,
        size: 10,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
  }
  out.setTitle(state.title);
  out.setAuthor(state.author);
  out.setProducer("Final Reader — editor local");
  const id = PDFHexString.of(uid().replaceAll("-", ""));
  out.context.trailerInfo.ID = out.context.obj([id, id]);
  return out.save({ useObjectStreams: true });
}
