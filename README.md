# Lui Wallet

App personal para visualizar y registrar gastos desde el celular, usando como base un Google Sheet mensual de finanzas.

## Incluye

- Dashboard mobile-first con saldo al día, recibido y gasto acumulado desde Google Sheets.
- Barra de presupuesto para ver cuando te acercas al límite del mes.
- Widgets por categoría: Fijos, Necesarios, Pendejos y Salidas.
- Timeline de movimientos con búsqueda.
- Captura rápida de gastos/ingresos.
- Cola local cuando no hay conexión o cuando falta configurar Google Sheets.
- PWA básica para instalar desde Safari/Chrome.

## Run Local

```bash
python3 -m http.server 4173
```

Abre `http://127.0.0.1:4173/`. También puedes abrir `index.html` directo en el navegador; para instalarla como PWA conviene servirla por HTTP.

## Build

No requiere build. La app vive en `index.html`, `app.js`, `styles.css`, `manifest.webmanifest` y `service-worker.js`.

## Google Sheets Sync

La app no guarda credenciales privadas de Google en el navegador. Para que **Guardar movimiento**, editar y eliminar escriban en tu Google Sheet, crea un webhook con Google Apps Script:

1. Abre tu Google Sheet.
2. Ve a **Extensions > Apps Script**.
3. Reemplaza el contenido por el archivo [`apps-script.gs`](./apps-script.gs) de este repositorio. La versión anterior solo agregaba filas; esta versión también actualiza y elimina.
4. Deploy > New deployment > Web app.
5. Ejecutar como: tu usuario. Acceso: solo tu usuario o quien corresponda.
6. Copia el URL `/exec` y pégalo en **Ajustes > Webhook Apps Script** dentro de la app.

```js
const SUMMARY_MONTH = "Septiembre";
const CREDIT_RANGE = "B30:C40"; // Opcional: columna 1 nombre, columna 2 monto.

const CATEGORY_MAP = {
  income: { date: 1, description: 2, amount: 4 },
  fixed: { date: 11, description: 12, amount: 13 },
  necessary: { date: 15, description: 16, amount: 17 },
  fun: { date: 19, description: 20, amount: 21 },
  outflow: { date: 23, description: 24, amount: 25 },
};

function doGet(event) {
  const callback = event.parameter.callback;
  const month = event.parameter.month || SUMMARY_MONTH;
  const payload = getSummary(month);

  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(payload)})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json(payload);
}

function doPost(event) {
  const payload = JSON.parse(event.postData.contents);
  const spreadsheet = SpreadsheetApp.openById("TU_SPREADSHEET_ID");
  const sheet = spreadsheet.getSheetByName(payload.month);
  const target = CATEGORY_MAP[payload.category];

  if (!sheet || !target) {
    return json({ ok: false, error: "Invalid sheet or category" });
  }

  const row = firstEmptyRow(sheet, target.description, 6, 120);
  sheet.getRange(row, target.date).setValue(new Date(payload.date));
  sheet.getRange(row, target.description).setValue(payload.description);
  sheet.getRange(row, target.amount).setValue(Number(payload.amount));

  return json({ ok: true, row });
}

function getSummary(month) {
  const spreadsheet = SpreadsheetApp.openById("TU_SPREADSHEET_ID");
  const sheet = spreadsheet.getSheetByName(month);

  if (!sheet) {
    return { ok: false, error: "Invalid sheet" };
  }

  return {
    ok: true,
    month,
    saldoAlDia: value(sheet, "H20"),
    totalReceived: value(sheet, "H17"),
    totalExpenses: valueBelowLabel(sheet, "TOTAL DE GASTOS"),
    ahorro: value(sheet, "D27") || value(sheet, "D26"),
    categoryTotals: {
      fixed: value(sheet, "N5"),
      necessary: value(sheet, "R5"),
      fun: value(sheet, "V5"),
      outflow: value(sheet, "Z5"),
    },
    credits: readCredits(sheet),
  };
}

function value(sheet, rangeA1) {
  return Number(sheet.getRange(rangeA1).getValue()) || 0;
}

function valueBelowLabel(sheet, label) {
  const values = sheet.getDataRange().getValues();
  const target = String(label).toLowerCase().trim();

  for (let row = 0; row < values.length - 1; row++) {
    for (let col = 0; col < values[row].length; col++) {
      if (String(values[row][col]).toLowerCase().trim() === target) {
        return Number(values[row + 1][col]) || 0;
      }
    }
  }

  return 0;
}

function readCredits(sheet) {
  return sheet.getRange(CREDIT_RANGE).getValues()
    .map(([name, amount]) => ({ name: String(name || "").trim(), amount: Number(amount) || 0 }))
    .filter((item) => item.name && item.amount);
}

function firstEmptyRow(sheet, column, startRow, endRow) {
  const values = sheet.getRange(startRow, column, endRow - startRow + 1, 1).getValues();
  const index = values.findIndex((row) => !row[0]);
  return index === -1 ? endRow + 1 : startRow + index;
}

function json(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Data Notes

La versión inicial queda lista para conectarse a Google Sheets. El resumen del dashboard se toma del Sheet para evitar variaciones locales:

- Pestañas mensuales: Enero a Septiembre.
- Septiembre usa bloques para ingresos, gastos fijos, gastos necesarios, pendejos y salidas.
- La captura rápida manda `month`, `category`, `date`, `description`, `amount`, `account` y `note` al webhook.
- El dashboard lee `Saldo al día` desde `H20`, `Total recibido` desde `H17`, `Ahorro` desde `D27` o `D26`, y `Gastado` desde el valor debajo de `TOTAL DE GASTOS`.
- La división de gastos lee `N5` para Fijos, `R5` para Necesarios, `V5` para Pendejos y `Z5` para Salidas.
- La lista de créditos se puede ajustar en `CREDIT_RANGE`; debe tener nombre en la primera columna y monto en la segunda.
