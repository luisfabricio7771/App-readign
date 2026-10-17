import { mkdir, cp, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

await mkdir('public/pdf', { recursive: true });
for (const name of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(`node_modules/pdfjs-dist/${name}`, `public/pdf/${name}`, { recursive: true });
}

// Original, redistributable reading sample. No external books or licensed artwork.
const chapters = [
  ['El primer umbral', 'La biblioteca apareció donde antes solo había una pared. Lía lo supo por el olor: lluvia sobre piedra caliente, papel antiguo y algo parecido a la electricidad. Apoyó la mano en la puerta. Del otro lado, una criatura respiraba al mismo ritmo que ella.'],
  ['Una luz entre las ruinas', 'La primera sala no tenía techo. Sobre los estantes brillaban estrellas que no pertenecían a ningún cielo conocido. Una lámpara esperaba encendida en el centro. En su base alguien había grabado una frase: para encontrar el camino, aprende a mirar despacio.'],
  ['El guardián sin nombre', 'El dragón dormía sobre un círculo de páginas. Sus escamas no eran negras, sino del color que queda cuando se apaga una vela. Lía no buscó una espada. Abrió el libro que llevaba bajo el brazo y comenzó a leer en voz baja.'],
  ['La cartografía del silencio', 'Cada mapa mostraba un territorio diferente, pero todos compartían un mismo punto: una pequeña isla sin nombre. Lía la dibujó en su cuaderno. Al terminar el último trazo, escuchó olas detrás del estante de astronomía.'],
  ['Las islas suspendidas', 'El puente no estaba hecho de piedra. Eran palabras enlazadas unas con otras, frases que sostenían el peso de quienes confiaban en ellas. Lía avanzó sin prisa. Bajo sus pies, el abismo tenía la paciencia de un océano.'],
  ['El taller de las mareas', 'Un relojero arreglaba relojes que medían cosas imposibles: el tiempo de un abrazo, la distancia entre dos recuerdos, los inviernos que caben en una despedida. Le regaló a Lía uno que solo avanzaba mientras ella aprendía algo nuevo.'],
  ['La semilla de cristal', 'Dentro de la caja había una semilla transparente. Al sostenerla contra la luz, Lía vio un bosque entero esperando. No había instrucciones. Decidió plantarla en el lugar más oscuro de la biblioteca, junto a los libros olvidados.'],
  ['Un nombre en la niebla', 'La niebla pronunciaba nombres a su paso. Algunos eran de personas que Lía conocía. Otros todavía no los había escuchado. Comprendió que aquel lugar guardaba también las historias que aún no habían sucedido.'],
  ['Los ojos de Véspera', 'Cuando el dragón abrió los ojos, no hubo rugido. Solo un destello violeta y una pregunta sencilla: qué has descubierto. Lía miró sus manos vacías, el cuaderno lleno y la puerta que ahora podía ver al fondo. Respondió: que todavía queda mucho.'],
  ['El corazón de ceniza', 'Tras el primer umbral, la sala estaba tibia. Una armadura de brasas vigilaba una fragua apagada. No pedía fuerza a quienes cruzaban. Pedía una historia que no conociera. Lía se sentó y buscó la primera página de su cuaderno.'],
  ['El jardín de invierno', 'En el jardín, cada flor guardaba una palabra que alguien había dejado de usar. Había nombres para colores que el mundo había olvidado y verbos para formas de querer. Lía se llevó uno pequeño, de pétalos azules.'],
  ['Una carta sin destino', 'La carta no tenía dirección. Su remitente había escrito solo: para quien necesite volver a empezar. Lía la guardó entre las páginas del atlas. A veces no era necesario entender un regalo en el momento de recibirlo.'],
  ['El observatorio', 'El telescopio apuntaba hacia adentro. Por su lente se veían constelaciones de recuerdos, pequeñas luces unidas por decisiones. Algunas se apagaban. Otras acababan de nacer. Lía encontró la que llevaba hasta aquella puerta.'],
  ['La reina de la escarcha', 'La reina no vivía en un palacio, sino en una pausa. Todo a su alrededor esperaba: una gota a punto de caer, un pájaro antes del vuelo, una respuesta todavía sin decir. Lía aprendió que esperar también podía ser una forma de avanzar.'],
  ['El camino de regreso', 'Había marcado cada cruce con una cinta dorada. Al regresar, descubrió que las cintas se habían convertido en hojas. El bosque no borraba sus pasos; los estaba haciendo suyos. Siguió caminando sin deshacer el camino.'],
  ['La ciudad de papel', 'Las casas cambiaban de forma cuando alguien las describía. Un panadero las llamaba refugios y se volvían cálidas. Una niña las llamaba naves y abrían las ventanas al cielo. Lía eligió llamarlas hogares.'],
  ['El juramento roto', 'El caballero bajó la espada antes de que ella hablara. Llevaba tantos años protegiendo el puente que había olvidado qué había al otro lado. Lía le ofreció el atlas. Ninguno de los dos sabía la respuesta, y eso les pareció un buen comienzo.'],
  ['Una lámpara prestada', 'La lámpara no iluminaba más lejos, sino con más atención. Revelaba la costura de una hoja, las huellas diminutas sobre el polvo y la expresión de una estatua. No cambiaba el mundo. Cambiaba cuánto de él podía ver.'],
  ['El peso de una página', 'Lía encontró una balanza junto a una pila de libros. En un plato colocó una piedra; en el otro, una página. La página pesaba más. El bibliotecario sonrió: hay cosas que crecen cuanto más las compartes.'],
  ['Las voces del río', 'El río no llevaba agua, sino conversaciones. Quien se acercaba podía escuchar preguntas de otros viajeros. Lía dejó la suya junto a una orilla y siguió adelante. No todas las preguntas necesitan una respuesta inmediata.'],
  ['El eco del infinito', 'La entidad no tenía rostro. Era un círculo de luz, una mirada enorme en medio del silencio. Le mostró a Lía todos los caminos que podría tomar. Ella cerró los ojos y eligió el siguiente paso. Solo uno. Era suficiente.'],
  ['El último estante', 'Al final de la biblioteca había un estante vacío. Una pequeña placa decía: las historias que todavía vas a vivir. Lía dejó allí su cuaderno, abierto por una página en blanco. La semilla de cristal florecía al otro lado de la sala.'],
  ['Volver a abrir la puerta', 'Cuando salió, la calle seguía en el mismo sitio. La panadería olía a mañana y alguien barría hojas junto a una ventana. Nada parecía haber cambiado. Lía caminó a casa con el atlas bajo el brazo. Esa noche, antes de dormir, leyó una página más.']
];
const pdf = await PDFDocument.create();
pdf.setTitle('El atlas de los umbrales');
pdf.setAuthor('Final Reader — relato original');
const regular = await pdf.embedFont(StandardFonts.TimesRoman);
const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
const sans = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const cover = pdf.addPage([600, 800]);
cover.drawRectangle({ x: 0, y: 0, width: 600, height: 800, color: rgb(.09, .07, .14) });
for (let i = 0; i < 5; i++) cover.drawCircle({ x: 300, y: 445, size: 80 + i * 27, borderWidth: .6, borderColor: rgb(.38, .29, .52), opacity: .6 });
cover.drawText('FINAL READER  /  BIBLIOTECA DE MUESTRA', { x: 100, y: 708, size: 10, font: sans, color: rgb(.72, .64, .85) });
cover.drawText('El atlas de', { x: 152, y: 465, size: 47, font: regular, color: rgb(.94, .9, .98) });
cover.drawText('los umbrales', { x: 123, y: 410, size: 47, font: italic, color: rgb(.76, .62, .98) });
cover.drawText('Un pequeño viaje hacia lo desconocido', { x: 156, y: 274, size: 14, font: italic, color: rgb(.8, .75, .86) });
cover.drawText('RELATO ORIGINAL  -  24 PÁGINAS', { x: 202, y: 106, size: 10, font: sans, color: rgb(.63, .55, .74) });
for (const [index, [title, paragraph]] of chapters.entries()) {
  const page = pdf.addPage([600, 800]);
  const ink = rgb(.15, .13, .19);
  page.drawText('EL ATLAS DE LOS UMBRALES', { x: 75, y: 742, size: 9, font: sans, color: rgb(.44, .4, .5) });
  page.drawLine({ start: { x: 75, y: 725 }, end: { x: 525, y: 725 }, thickness: .5, color: rgb(.8, .76, .85) });
  page.drawText(`CAPÍTULO ${String(index + 1).padStart(2, '0')}`, { x: 75, y: 657, size: 10, font: bold, color: rgb(.49, .36, .64) });
  page.drawText(title, { x: 75, y: 615, size: 28, font: regular, color: ink });
  const paragraphs = [paragraph, 'Se detuvo un momento para observar. En aquel lugar, los detalles importaban más que la distancia recorrida. Una marca en la madera, un rumor entre los estantes, una nota escrita al margen: todo podía ser una invitación a descubrir algo.', 'No tenía que llegar a ninguna parte deprisa. El camino se construía mientras lo recorría, como las historias que solo existen cuando alguien decide abrir un libro. Respiró hondo y continuó.'];
  let y = 557;
  for (const para of paragraphs) {
    let line = '';
    for (const word of para.split(' ')) {
      if (regular.widthOfTextAtSize(`${line} ${word}`, 15) > 450) {
        page.drawText(line, { x: 75, y, size: 15, font: regular, color: ink }); y -= 25; line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    page.drawText(line, { x: 75, y, size: 15, font: regular, color: ink }); y -= 45;
  }
  page.drawText(String(index + 2), { x: 294, y: 43, size: 11, font: sans, color: rgb(.5, .45, .55) });
}
await writeFile('public/sample.pdf', await pdf.save());

// Minimal PNG writer keeps installation independent of native image packages.
function crc32(data) { let crc = -1; for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ -1) >>> 0; }
function chunk(type, data) { const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4); length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([length, name, data, crc]); }
function icon(size, inset = .18) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / size, ny = y / size;
    const top = inset, bottom = 1 - inset, middle = .46;
    const width = (ny < middle ? (ny - top) / (middle - top) : (bottom - ny) / (bottom - middle)) * (0.5 - inset) * .9;
    const diamond = ny > top && ny < bottom && Math.abs(nx - .5) < width;
    const color = diamond ? (Math.abs(nx - .5) < width * .27 ? [225, 208, 255] : nx < .5 ? [180, 143, 241] : [112, 69, 188]) : [21, 18, 31];
    const i = y * (size * 4 + 1) + 1 + x * 4; raw.set([...color, 255], i);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const [name, size, inset] of [['icon-192.png', 192, .16], ['icon-512.png', 512, .16], ['icon-maskable.png', 512, .25], ['apple-touch-icon.png', 180, .18]]) await writeFile(`public/${name}`, icon(size, inset));
console.log('Local PDF assets, original sample and PWA icons prepared.');
