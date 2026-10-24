import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Modal } from "./components";
import { getFile, loadEditorDraft, saveEditorDraft } from "./storage";
import {
  editPDF,
  inspectSource,
  parsePages,
  uid,
  type EditState,
  type Mark,
  type Tool,
  type Point,
  type FormField,
} from "./pdf-edit";
import { openPdf } from "./pdf";
import "./pdf-editor.css";
interface Props {
  bookId: string;
  title: string;
  onClose: () => void;
  onImport: (file: File) => Promise<void>;
}
const tools: { id: Tool; label: string }[] = [
  { id: "select", label: "Seleccionar / mover" },
  { id: "text", label: "Texto" },
  { id: "highlight", label: "Resaltar" },
  { id: "pen", label: "Lápiz" },
  { id: "signature", label: "Firma dibujada" },
  { id: "rect", label: "Rectángulo" },
  { id: "ellipse", label: "Elipse" },
  { id: "line", label: "Línea" },
  { id: "image", label: "Imagen" },
];
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export default function PdfEditor({ bookId, title, onClose, onImport }: Props) {
  const [sources, setSources] = useState<Uint8Array[]>([]);
  const [state, setState] = useState<EditState>();
  const [fields, setFields] = useState<FormField[]>([]);
  const [index, setIndex] = useState(0),
    [tool, setTool] = useState<Tool>("select"),
    [color, setColor] = useState("#a67cf5"),
    [size, setSize] = useState(3),
    [text, setText] = useState("Texto nuevo"),
    [image, setImage] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [range, setRange] = useState("1"),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState<Mark>();
  const [view, setView] = useState({ width: 600, height: 800 }),
    [zoom, setZoom] = useState(0.8),
    [previewBusy, setPreviewBusy] = useState(true);
  const [revision, setRevision] = useState(0),
    [confirmReset, setConfirmReset] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const undo = useRef<EditState[]>([]),
    redo = useRef<EditState[]>([]);
  const gesture = useRef<
    { start: Point; mark?: Mark; original?: Mark } | undefined
  >(undefined);
  const latest = useRef({ state, sources });
  latest.current = { state, sources };
  const sheet = state?.pages[Math.min(index, state.pages.length - 1)];
  const change = useCallback((next: EditState) => {
    const old = latest.current.state;
    if (old) {
      undo.current = [...undo.current.slice(-29), old];
      redo.current = [];
    }
    latest.current.state = next;
    setState(next);
    setRevision((v) => v + 1);
    setStatus("Guardando borrador…");
  }, []);
  const history = (back: boolean) => {
    const from = back ? undo : redo,
      to = back ? redo : undo;
    const next = from.current.pop();
    if (next && state) {
      to.current.push(state);
      setState(next);
      setRevision((v) => v + 1);
      setSelected("");
    }
  };
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [file, saved] = await Promise.all([
          getFile(bookId),
          loadEditorDraft(bookId),
        ]);
        if (!file) throw Error("No se encontró el archivo original.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        const all = [bytes, ...(saved?.extraSources || [])];
        const infos = await Promise.all(all.map((v, i) => inspectSource(v, i)));
        if (cancelled) return;
        setSources(all);
        setFields(infos.flatMap((v) => v.fields));
        setState(
          saved?.state || {
            pages: infos[0].pages,
            marks: [],
            title: `${title} — editado`,
            author: "",
            watermark: "",
            numberPages: false,
            fields: {},
          },
        );
        setStatus(
          saved
            ? "Borrador recuperado"
            : "Original protegido · edita una copia",
        );
      } catch (e) {
        if (!cancelled)
          setError(
            `No se pudo abrir el editor: ${(e as Error).message}. Los PDF cifrados deben guardarse primero como una copia sin contraseña.`,
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, title]);
  useEffect(() => {
    if (!state) return;
    let active = true;
    const timer = setTimeout(() => {
      void saveEditorDraft(bookId, { state, extraSources: sources.slice(1) })
        .then(() => {
          if (active) setStatus("Borrador guardado en este dispositivo");
        })
        .catch(() => {
          if (active)
            setError(
              "No se pudo guardar el borrador. Exporta una copia y comprueba el espacio disponible.",
            );
        });
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [bookId, state, sources]);
  useEffect(() => {
    const flush = () => {
      const { state, sources } = latest.current;
      if (state)
        void saveEditorDraft(bookId, {
          state,
          extraSources: sources.slice(1),
        }).catch(() => {});
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [bookId]);
  useEffect(() => {
    if (!sheet || !state) return;
    let cancelled = false;
    let doc: Awaited<ReturnType<typeof openPdf>> | undefined;
    setPreviewBusy(true);
    const timer = setTimeout(() => { void (async () => {
      try {
        const bytes = await editPDF(
          sources,
          { ...state, marks: [], watermark: "", numberPages: false },
          [Math.min(index, state.pages.length - 1)],
          false,
        );
        if (cancelled) return;
        doc = await openPdf(new Blob([bytes as BlobPart]));
        const page = await doc.getPage(1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(2, 1200 / base.width),
        });
        const off = document.createElement("canvas");
        off.width = viewport.width;
        off.height = viewport.height;
        await page.render({ canvas: off, viewport }).promise;
        if (cancelled) return;
        const target = canvas.current;
        if (target) {
          target.width = off.width;
          target.height = off.height;
          target.getContext("2d")!.drawImage(off, 0, 0);
          setView({ width: base.width, height: base.height });
        }
      } catch (e) {
        if (!cancelled) setError(`Vista previa: ${(e as Error).message}`);
      } finally {
        await doc?.loadingTask.destroy();
        if (!cancelled) setPreviewBusy(false);
      }
    })(); }, 180);
    return () => {
      cancelled = true; clearTimeout(timer);
    };
    // Marks use a vector overlay; drawing does not re-render the PDF on every pointer move.
  }, [sheet?.id, sheet?.rotation, sheet?.crop, sources, state?.fields, index]);
  useEffect(() => {
    if (state && index >= state.pages.length) setIndex(state.pages.length - 1);
  }, [state, index]);
  const close = async () => {
    if (busy) return;
    try {
      const current = latest.current;
      if (current.state)
        await saveEditorDraft(bookId, {
          state: current.state,
          extraSources: current.sources.slice(1),
        });
      onClose();
    } catch {
      setError("No se pudo guardar el borrador. Exporta antes de cerrar.");
    }
  };
  const point = (e: PointerEvent) => {
    const r = surface.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width),
      y: clamp((e.clientY - r.top) / r.height),
    };
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!sheet || !state || previewBusy || busy || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    if (tool === "select") {
      const hit = [...state.marks]
        .reverse()
        .find(
          (m) =>
            m.pageId === sheet.id &&
            p.x >= m.x - 0.015 &&
            p.y >= m.y - 0.015 &&
            p.x <= m.x + m.w + 0.015 &&
            p.y <= m.y + m.h + 0.02,
        );
      setSelected(hit?.id || "");
      if (hit) {
        setText(hit.text || "");
        setColor(hit.color);
        setSize(hit.tool === "text" ? hit.size / 4 : hit.size);
      }
      gesture.current = { start: p, original: hit };
      return;
    }
    if (tool === "image" && !image) {
      setError("Primero elige una imagen PNG o JPG.");
      return;
    }
    const mark: Mark = {
      id: uid(),
      pageId: sheet.id,
      tool,
      x: p.x,
      y: p.y,
      w: 0,
      h: 0,
      color:
        tool === "highlight"
          ? "#ffdf32"
          : tool === "signature"
            ? "#171421"
            : color,
      size: tool === "text" ? size * 4 : size,
      text,
      image,
      points: [p],
    };
    gesture.current = { start: p, mark };
    setDraft(mark);
    setError("");
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const p = point(e);
    if (g.original) {
      const m = g.original;
      const dx = Math.max(-m.x, Math.min(1 - m.x - m.w, p.x - g.start.x)),
        dy = Math.max(-m.y, Math.min(1 - m.y - m.h, p.y - g.start.y));
      setDraft({
        ...m,
        x: m.x + dx,
        y: m.y + dy,
        points: m.points?.map((v) => ({ x: v.x + dx, y: v.y + dy })),
      });
      return;
    }
    if (!g.mark) return;
    const m = g.mark;
    if (m.tool === "pen" || m.tool === "signature") {
      if ((m.points?.length || 0) < 2500) m.points!.push(p);
      const xs = m.points!.map((v) => v.x),
        ys = m.points!.map((v) => v.y);
      setDraft({
        ...m,
        points: [...m.points!],
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      });
    } else
      setDraft({
        ...m,
        points: m.tool === "line" ? [g.start, p] : m.points,
        x: Math.min(g.start.x, p.x),
        y: Math.min(g.start.y, p.y),
        w: Math.abs(p.x - g.start.x),
        h: Math.abs(p.y - g.start.y),
      });
  };
  const up = () => {
    const g = gesture.current;
    gesture.current = undefined;
    if (!g || !state || !draft) {
      setDraft(undefined);
      return;
    }
    let mark = draft;
    if (g.original) {
      change({
        ...state,
        marks: state.marks.map((m) => (m.id === mark.id ? mark : m)),
      });
    } else {
      if (mark.tool === "text")
        mark = {
          ...mark,
          w: Math.min(0.45, 1 - mark.x),
          h: Math.min(0.1, 1 - mark.y),
        };
      else if (mark.tool === "image" && mark.w < 0.01)
        mark = {
          ...mark,
          w: Math.min(0.3, 1 - mark.x),
          h: Math.min(0.2, 1 - mark.y),
        };
      if (mark.tool === "text" || mark.w > 0.002 || mark.h > 0.002) {
        change({ ...state, marks: [...state.marks, mark] });
        setSelected(mark.id);
      }
    }
    setDraft(undefined);
  };
  const mutateSheet = (
    fn: (pages: EditState["pages"]) => EditState["pages"],
  ) => {
    if (state) change({ ...state, pages: fn(state.pages) });
  };
  const exportFile = async (
    mode: "download" | "library" | "extract" | "png" | "print",
  ) => {
    if (!state) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "png") {
        if (!canvas.current) throw Error("Espera a la vista previa.");
        const bytes = await editPDF(sources, state, [index]);
        const doc = await openPdf(new Blob([bytes as BlobPart]));
        try {
          const page = await doc.getPage(1),
            viewport = page.getViewport({ scale: 2 });
          const c = document.createElement("canvas");
          c.width = viewport.width;
          c.height = viewport.height;
          await page.render({ canvas: c, viewport }).promise;
          const blob = await new Promise<Blob>((resolve, reject) =>
            c.toBlob(
              (v) => (v ? resolve(v) : reject(Error("No se pudo crear PNG."))),
              "image/png",
            ),
          );
          download(blob, `${state.title}-pagina-${index + 1}.png`);
        } finally {
          await doc.loadingTask.destroy();
        }
        return;
      }
      const selected =
        mode === "extract" ? parsePages(range, state.pages.length) : undefined;
      const bytes = await editPDF(sources, state, selected);
      const file = new File(
        [bytes as BlobPart],
        `${state.title.replace(/[<>:"/\\|?*]/g, "_") || "Documento"}${selected ? "-extraido" : ""}.pdf`,
        { type: "application/pdf" },
      );
      if (mode === "library") {
        await onImport(file);
        onClose();
      } else if (mode === "print") {
        await printPDF(bytes);
      } else download(file, file.name);
      setStatus("Copia exportada · el original y su progreso se conservan");
    } catch (e) {
      setError(
        `No se pudo exportar: ${(e as Error).message}. El texto añadido debe usar caracteres compatibles con la fuente latina.`,
      );
    } finally {
      setBusy(false);
    }
  };
  const addFiles = async (files: FileList | null) => {
    if (!files || !state) return;
    setBusy(true);
    setError("");
    try {
      const bytes: Uint8Array[] = [];
      const added: EditState["pages"] = [];
      const addedFields: FormField[] = [];
      for (const file of files) {
        const data = new Uint8Array(await file.arrayBuffer()),
          i = sources.length + bytes.length;
        const info = await inspectSource(data, i);
        bytes.push(data);
        added.push(...info.pages);
        addedFields.push(...info.fields);
      }
      setSources([...sources, ...bytes]);
      setFields([...fields, ...addedFields]);
      change({
        ...state,
        pages: [
          ...state.pages.slice(0, index + 1),
          ...added,
          ...state.pages.slice(index + 1),
        ],
      });
      setIndex(index + 1);
    } catch (e) {
      setError(`No se pudo unir el PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const artwork = (m: Mark) => {
    const x = m.x * view.width,
      y = m.y * view.height,
      w = m.w * view.width,
      h = m.h * view.height;
    const common = { stroke: m.color, strokeWidth: m.size, fill: "none" };
    if (m.tool === "text")
      return (
        <text
          x={x}
          y={y + m.size}
          fill={m.color}
          fontFamily="Arial"
          fontSize={m.size}
        >
          {(m.text || "").split("\n").map((line, i) => (
            <tspan x={x} dy={i ? m.size * 1.25 : 0} key={i}>
              {line}
            </tspan>
          ))}
        </text>
      );
    if (m.tool === "image")
      return (
        <image
          href={m.image}
          x={x}
          y={y}
          width={w}
          height={h}
          preserveAspectRatio="xMinYMin meet"
        />
      );
    if (m.tool === "pen" || m.tool === "signature")
      return (
        <polyline
          points={m.points
            ?.map((p) => `${p.x * view.width},${p.y * view.height}`)
            .join(" ")}
          {...common}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    if (m.tool === "line")
      return (
        <line
          x1={(m.points?.[0]?.x ?? m.x) * view.width}
          y1={(m.points?.[0]?.y ?? m.y) * view.height}
          x2={(m.points?.[1]?.x ?? m.x + m.w) * view.width}
          y2={(m.points?.[1]?.y ?? m.y + m.h) * view.height}
          {...common}
        />
      );
    if (m.tool === "ellipse")
      return (
        <ellipse
          cx={x + w / 2}
          cy={y + h / 2}
          rx={w / 2}
          ry={h / 2}
          {...common}
        />
      );
    return (
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        {...common}
        fill={m.tool === "highlight" ? m.color : "none"}
        opacity={m.tool === "highlight" ? 0.3 : 1}
      />
    );
  };
  return (
    <Modal title="Taller PDF" wide onClose={() => void close()}>
      <div className="pdf-workshop" aria-busy={busy}>
        <p className="helper">
          Edición local sobre una copia. Los formularios se exportan como
          contenido fijo. La copia puede omitir comentarios, enlaces y marcadores previos. Modificar un PDF invalida sus firmas digitales.
          Recortar o tapar contenido no lo elimina de forma segura.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!state ? (
          <p>Preparando documento…</p>
        ) : (
          <>
            <div className="edit-actions">
              <button
                className="button secondary compact"
                disabled={busy || !undo.current.length}
                onClick={() => history(true)}
              >
                Deshacer
              </button>
              <button
                className="button secondary compact"
                disabled={busy || !redo.current.length}
                onClick={() => history(false)}
              >
                Rehacer
              </button>
              <span role="status">{busy ? "Procesando…" : status}</span>
              <button
                className="button primary compact"
                disabled={busy}
                onClick={() => void exportFile("download")}
              >
                Descargar PDF editado
              </button>
              <button
                className="button secondary compact"
                disabled={busy}
                onClick={() => void exportFile("library")}
              >
                Guardar copia en biblioteca
              </button>
            </div>
            <fieldset disabled={busy}>
              <div className="edit-layout">
                <aside className="edit-controls">
                  <h3>Anotar</h3>
                  <div className="edit-tools">
                    {tools.map((t) => (
                      <button
                        key={t.id}
                        className={`button compact ${tool === t.id ? "primary" : "secondary"}`}
                        onClick={() => setTool(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <label className="field">
                    Texto que añadir
                    <textarea
                      value={text}
                      maxLength={2000}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Color
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Grosor / tamaño
                    <input
                      type="range"
                      min="1"
                      max="16"
                      value={size}
                      onChange={(e) => setSize(Number(e.target.value))}
                    />
                  </label>
                  <label className="field">
                    Imagen o firma escaneada
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          void (async () => {
                            try {
                              if (file.size > 15 * 1024 * 1024)
                                throw Error("Máximo 15 MB.");
                              const bitmap = await createImageBitmap(file),
                                c = document.createElement("canvas");
                              const scale = Math.min(
                                1,
                                1600 / Math.max(bitmap.width, bitmap.height),
                              );
                              c.width = Math.round(bitmap.width * scale);
                              c.height = Math.round(bitmap.height * scale);
                              c.getContext("2d")!.drawImage(
                                bitmap,
                                0,
                                0,
                                c.width,
                                c.height,
                              );
                              bitmap.close();
                              setImage(c.toDataURL("image/png"));
                              setTool("image");
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          })();
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p className="helper">
                    Haz clic para colocar texto. Arrastra para dibujar o colocar
                    una imagen. La firma dibujada no es una firma digital
                    certificada.
                  </p>
                  <button
                    className="button secondary compact"
                    disabled={!selected}
                    onClick={() =>
                      change({
                        ...state,
                        marks: state.marks.map((m) =>
                          m.id === selected
                            ? {
                                ...m,
                                color,
                                size: m.tool === "text" ? size * 4 : size,
                                text: m.tool === "text" ? text : m.text,
                              }
                            : m,
                        ),
                      })
                    }
                  >
                    Actualizar anotación seleccionada
                  </button>
                  <button
                    className="button secondary compact"
                    disabled={!selected}
                    onClick={() => {
                      change({
                        ...state,
                        marks: state.marks.filter((m) => m.id !== selected),
                      });
                      setSelected("");
                    }}
                  >
                    Eliminar anotación seleccionada
                  </button>
                  <h3>Páginas</h3>
                  <label className="field">
                    Página del documento
                    <select
                      aria-label="Página del editor"
                      value={index}
                      onChange={(e) => {
                        setIndex(Number(e.target.value));
                        setSelected("");
                      }}
                    >
                      {state.pages.map((p, i) => (
                        <option value={i} key={p.id}>
                          Página {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="edit-tools">
                    <button
                      className="button secondary compact"
                      onClick={() => {
                        const page = {
                          id: uid(),
                          source: 0,
                          index: -1,
                          rotation: 0,
                          crop: 0,
                        };
                        change({
                          ...state,
                          pages: [
                            ...state.pages.slice(0, index + 1),
                            page,
                            ...state.pages.slice(index + 1),
                          ],
                        });
                        setIndex(index + 1);
                      }}
                    >
                      Insertar página en blanco
                    </button>
                    <button
                      className="button secondary compact"
                      onClick={() =>
                        mutateSheet((p) =>
                          p.map((v) =>
                            v.id === sheet?.id
                              ? { ...v, rotation: (v.rotation + 90) % 360 }
                              : v,
                          ),
                        )
                      }
                    >
                      Girar 90°
                    </button>
                    <button
                      className="button secondary compact"
                      onClick={() => {
                        if (sheet) {
                          const copy = { ...sheet, id: uid() };
                          change({
                            ...state,
                            pages: [
                              ...state.pages.slice(0, index + 1),
                              copy,
                              ...state.pages.slice(index + 1),
                            ],
                            marks: [
                              ...state.marks,
                              ...state.marks
                                .filter((m) => m.pageId === sheet.id)
                                .map((m) => ({
                                  ...m,
                                  id: uid(),
                                  pageId: copy.id,
                                })),
                            ],
                          });
                          setIndex(index + 1);
                        }
                      }}
                    >
                      Duplicar página
                    </button>
                    <button
                      className="button secondary compact"
                      disabled={state.pages.length <= 1}
                      onClick={() => {
                        if (sheet)
                          change({
                            ...state,
                            pages: state.pages.filter((p) => p.id !== sheet.id),
                            marks: state.marks.filter(
                              (m) => m.pageId !== sheet.id,
                            ),
                          });
                      }}
                    >
                      Eliminar página
                    </button>
                    <button
                      className="button secondary compact"
                      disabled={index === 0}
                      onClick={() => {
                        const pages = [...state.pages];
                        [pages[index - 1], pages[index]] = [
                          pages[index],
                          pages[index - 1],
                        ];
                        change({ ...state, pages });
                        setIndex(index - 1);
                      }}
                    >
                      Mover antes
                    </button>
                    <button
                      className="button secondary compact"
                      disabled={index >= state.pages.length - 1}
                      onClick={() => {
                        const pages = [...state.pages];
                        [pages[index], pages[index + 1]] = [
                          pages[index + 1],
                          pages[index],
                        ];
                        change({ ...state, pages });
                        setIndex(index + 1);
                      }}
                    >
                      Mover después
                    </button>
                  </div>
                  <label className="field">
                    Recortar márgenes (%)
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={sheet?.crop || 0}
                      onChange={(e) => {
                        const crop = Number(e.target.value);
                        if (crop >= 0 && crop <= 40)
                          mutateSheet((p) =>
                            p.map((v) =>
                              v.id === sheet?.id ? { ...v, crop } : v,
                            ),
                          );
                      }}
                    />
                  </label>
                  <label className="field">
                    Unir / insertar PDF después de esta página
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      multiple
                      onChange={(e) => {
                        void addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="field">
                    Extraer páginas (ej. 1-3, 5)
                    <input
                      value={range}
                      onChange={(e) => setRange(e.target.value)}
                    />
                  </label>
                  <button
                    className="button secondary compact"
                    onClick={() => void exportFile("extract")}
                  >
                    Extraer selección a otro PDF
                  </button>
                  <h3>Documento</h3>
                  <label className="field">
                    Título del PDF
                    <input
                      value={state.title}
                      maxLength={150}
                      onChange={(e) =>
                        change({ ...state, title: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    Autor
                    <input
                      value={state.author}
                      maxLength={150}
                      onChange={(e) =>
                        change({ ...state, author: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    Marca de agua
                    <input
                      value={state.watermark}
                      maxLength={100}
                      onChange={(e) =>
                        change({ ...state, watermark: e.target.value })
                      }
                    />
                  </label>
                  <label className="toggle-row">
                    Numerar páginas
                    <input
                      type="checkbox"
                      checked={state.numberPages}
                      onChange={(e) =>
                        change({ ...state, numberPages: e.target.checked })
                      }
                    />
                  </label>
                  {fields.length > 0 && (
                    <>
                      <h3>Rellenar formulario</h3>
                      {fields.map((f) => (
                        <label className="field" key={f.key}>
                          {f.label}
                          {f.type === "check" ? (
                            <input
                              type="checkbox"
                              checked={Boolean(state.fields[f.key] ?? f.value)}
                              onChange={(e) =>
                                change({
                                  ...state,
                                  fields: {
                                    ...state.fields,
                                    [f.key]: e.target.checked,
                                  },
                                })
                              }
                            />
                          ) : f.type === "select" ? (
                            <select
                              value={String(state.fields[f.key] ?? f.value)}
                              onChange={(e) =>
                                change({
                                  ...state,
                                  fields: {
                                    ...state.fields,
                                    [f.key]: e.target.value,
                                  },
                                })
                              }
                            >
                              <option value="">Sin selección</option>
                              {f.options?.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={String(state.fields[f.key] ?? f.value)}
                              maxLength={2000}
                              onChange={(e) =>
                                change({
                                  ...state,
                                  fields: {
                                    ...state.fields,
                                    [f.key]: e.target.value,
                                  },
                                })
                              }
                            />
                          )}
                        </label>
                      ))}
                    </>
                  )}
                  <button
                    className="button secondary compact"
                    onClick={() => void exportFile("png")}
                  >
                    Exportar página como PNG
                  </button>
                  <button
                    className="button secondary compact"
                    onClick={() => void exportFile("print")}
                  >
                    Imprimir documento editado
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setConfirmReset(true)}
                  >
                    Descartar todo el borrador
                  </button>
                  {confirmReset && (
                    <div className="info-box">
                      <p>
                        Se quitarán todas las ediciones de este borrador. El
                        original se conserva.
                      </p>
                      <button
                        onClick={() => {
                          void (async () => {
                            const info = await inspectSource(sources[0], 0);
                            change({
                              pages: info.pages,
                              marks: [],
                              title: `${title} — editado`,
                              author: "",
                              watermark: "",
                              numberPages: false,
                              fields: {},
                            });
                            setIndex(0);
                            setConfirmReset(false);
                          })();
                        }}
                      >
                        Sí, descartar ediciones
                      </button>
                      <button onClick={() => setConfirmReset(false)}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </aside>
                <section className="edit-preview">
                  <div className="edit-zoom">
                    <label>
                      Zoom del editor{" "}
                      <input
                        type="range"
                        min=".3"
                        max="1.5"
                        step=".1"
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                      />
                    </label>
                    <span>
                      Página {index + 1} de {state.pages.length}
                      {previewBusy ? " · Preparando…" : ""}
                    </span>
                  </div>
                  <div
                    className="edit-paper"
                    ref={surface}
                    data-preview-busy={previewBusy}
                    style={{
                      width: view.width * zoom,
                      height: view.height * zoom,
                    }}
                    onPointerDown={down}
                    onPointerMove={move}
                    onPointerUp={up}
                    onPointerCancel={() => {
                      gesture.current = undefined;
                      setDraft(undefined);
                    }}
                    aria-label="Lienzo del editor PDF"
                  >
                    <canvas ref={canvas} />
                    <svg
                      viewBox={`0 0 ${view.width} ${view.height}`}
                      aria-hidden="true"
                    >
                      {state.marks
                        .filter(
                          (m) => m.pageId === sheet?.id && m.id !== draft?.id,
                        )
                        .map((m) => (
                          <g key={m.id}>
                            {artwork(m)}
                            {selected === m.id && (
                              <rect
                                x={m.x * view.width - 2}
                                y={m.y * view.height - 2}
                                width={m.w * view.width + 4}
                                height={m.h * view.height + 4}
                                fill="none"
                                stroke="#8c59d4"
                                strokeWidth="1"
                                strokeDasharray="4 3"
                              />
                            )}
                          </g>
                        ))}
                      {draft && artwork(draft)}
                      {state.watermark && (
                        <text
                          x={view.width * 0.12}
                          y={view.height * 0.62}
                          fontSize={Math.min(
                            44,
                            (view.width / Math.max(8, state.watermark.length)) *
                              1.3,
                          )}
                          opacity=".23"
                          fill="#808080"
                          transform={`rotate(-30 ${view.width * 0.12} ${view.height * 0.62})`}
                        >
                          {state.watermark}
                        </text>
                      )}
                      {state.numberPages && (
                        <text
                          x={view.width * 0.45}
                          y={view.height - 12}
                          fontSize="10"
                          fill="#595959"
                        >
                          {index + 1} / {state.pages.length}
                        </text>
                      )}
                    </svg>
                  </div>
                </section>
              </div>
            </fieldset>
          </>
        )}
        <span className="visually-hidden">{revision}</span>
      </div>
    </Modal>
  );
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function printPDF(bytes: Uint8Array) {
  const doc = await openPdf(new Blob([bytes as BlobPart]));
  const frame = document.createElement("iframe");
  frame.title = "Impresión del PDF editado";
  frame.className = "edit-print-frame";
  document.body.append(frame);
  try {
    const win = frame.contentWindow!,
      body = win.document.body;
    const style = win.document.createElement("style");
    style.textContent =
      "@page{margin:0}body{margin:0}img{width:100%;display:block;break-after:page}img:last-child{break-after:auto}";
    win.document.head.append(style);
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i),
        base = page.getViewport({ scale: 1 }),
        vp = page.getViewport({ scale: Math.min(1.5, 1600 / base.width) }),
        c = document.createElement("canvas");
      c.width = vp.width;
      c.height = vp.height;
      await page.render({ canvas: c, viewport: vp }).promise;
      const img = win.document.createElement("img");
      img.src = c.toDataURL("image/png");
      body.append(img);
      await img.decode();
    }
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 60000);
  } catch (e) {
    frame.remove();
    throw e;
  } finally {
    await doc.loadingTask.destroy();
  }
}
