const SPREADSHEET_ID = "1FjFrjkNb_7QENGgM4eCU0OnouztzCG6o4yTY7Z60_JQ";

// Column numbers are 1-based and match the monthly layout in Gastos 2026.
const CATEGORY_MAP = {
  income: { date: 2, description: 3, amount: 4 },
  fixed: { date: 11, description: 12, amount: 13 },
  necessary: { date: 15, description: 16, amount: 17 },
  fun: { date: 19, description: 20, amount: 21 },
  outflow: { date: 23, description: 24, amount: 25 },
};

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || "{}");
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(payload.month);
  const target = CATEGORY_MAP[payload.category];

  if (!sheet || !target) return json({ ok: false, error: "Invalid sheet or category" });

  const operation = payload.operation || "create";
  if (operation === "delete") return removeExpense(sheet, target, payload.row);
  if (operation === "update") return updateExpense(sheet, target, payload);
  return createExpense(sheet, target, payload);
}

function createExpense(sheet, target, payload) {
  const row = firstEmptyRow(sheet, target.description, 6, 120);
  writeExpense(sheet, target, row, payload);
  return json({ ok: true, row });
}

function updateExpense(sheet, target, payload) {
  const row = Number(payload.row);
  if (!Number.isInteger(row) || row < 1) return json({ ok: false, error: "Invalid row" });
  writeExpense(sheet, target, row, payload);
  return json({ ok: true, row });
}

function removeExpense(sheet, target, rowValue) {
  const row = Number(rowValue);
  if (!Number.isInteger(row) || row < 1) return json({ ok: false, error: "Invalid row" });
  sheet.getRange(row, target.date, 1, 3).clearContent();
  return json({ ok: true, row });
}

function writeExpense(sheet, target, row, payload) {
  sheet.getRange(row, target.date).setValue(new Date(payload.date));
  sheet.getRange(row, target.description).setValue(String(payload.description || "").trim());
  sheet.getRange(row, target.amount).setValue(Number(payload.amount) || 0);
}

function firstEmptyRow(sheet, column, startRow, endRow) {
  const values = sheet.getRange(startRow, column, endRow - startRow + 1, 1).getValues();
  const index = values.findIndex(([value]) => !value);
  return index === -1 ? endRow + 1 : startRow + index;
}

function json(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
