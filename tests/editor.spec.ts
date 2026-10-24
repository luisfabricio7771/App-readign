import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
test("editor saves a draft, exports real text and a reorganized copy without altering reading progress", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explorar una muestra", exact: true })
    .click();
  await expect(page.locator('.pdf-page[data-page="1"]')).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Página leída", exact: false })
    .click();
  await page.getByRole("button", { name: "Editar PDF", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Taller PDF", exact: true }),
  ).toBeVisible();
  const paper = dialog.locator(".edit-paper");
  await expect(paper).toHaveAttribute("data-preview-busy", "false");
  await expect
    .poll(() =>
      paper.locator("canvas").evaluate((c) => (c as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(300);
  await dialog.getByLabel("Texto que añadir").fill("Prueba de edición local");
  await dialog.getByRole("button", { name: "Texto", exact: true }).click();
  await paper.click({ position: { x: 80, y: 100 } });
  await expect(paper.locator("svg text").first()).toHaveText(
    "Prueba de edición local",
  );
  await dialog
    .getByRole("button", { name: "Cerrar ventana", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Editar PDF", exact: true }).click();
  await expect(page.getByRole("dialog").locator("svg text").first()).toHaveText(
    "Prueba de edición local",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Duplicar página", exact: true })
    .click();
  await expect(
    page.getByLabel("Página del editor").locator("option"),
  ).toHaveCount(25);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Deshacer", exact: true })
    .click();
  await expect(
    page.getByLabel("Página del editor").locator("option"),
  ).toHaveCount(24);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Insertar página en blanco", exact: true })
    .click();
  await expect(
    page.getByLabel("Página del editor").locator("option"),
  ).toHaveCount(25);
  const file = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar PDF editado", exact: true })
    .click();
  const downloaded = await file;
  expect(downloaded.suggestedFilename()).toMatch(/\.pdf$/);
  const path = await downloaded.path();
  const { readFile } = await import("node:fs/promises");
  const exported = await PDFDocument.load(await readFile(path!));
  expect(exported.getPageCount()).toBe(25);
  await page
    .getByRole("button", { name: "Guardar copia en biblioteca", exact: true })
    .click();
  await expect(page.locator(".reader-book-title h1")).toHaveText(
    "El atlas de los umbrales — editado",
  );
  await expect(page.locator(".pdf-page")).toHaveAttribute("data-ready", "true");
  await page
    .getByRole("button", { name: "Buscar en el libro", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Texto a buscar" })
    .fill("Prueba de edición local");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.locator(".search-summary")).toContainText(
    "1 coincidencias",
  );
  await page
    .getByRole("button", { name: "Volver a la biblioteca", exact: true })
    .click();
  await expect(page.locator(".book-card")).toHaveCount(2);
  const original = page
    .locator(".book-card")
    .filter({
      has: page.getByRole("heading", {
        name: "El atlas de los umbrales",
        exact: true,
      }),
    });
  await expect(original).toContainText("1 páginas leídas");
});
