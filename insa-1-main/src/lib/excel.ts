import ExcelJS from 'exceljs';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const VALID_EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

export function validateExcelFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return '파일 크기는 5MB를 초과할 수 없습니다.';
  const name = file.name.toLowerCase();
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    return 'Excel 파일(.xlsx, .xls)만 업로드할 수 있습니다.';
  }
  if (file.type && !VALID_EXCEL_MIME_TYPES.includes(file.type)) {
    return '유효한 Excel 파일만 업로드할 수 있습니다.';
  }
  return null;
}

export async function readExcelRows(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  const rows: Record<string, string>[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        headers.push(String(cell.value ?? ''));
      });
    } else {
      const obj: Record<string, string> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          // Strip leading formula injection characters (=, +, -, @)
          const raw = String(cell.value ?? '');
          obj[header] = raw.replace(/^[=+\-@\t\r]/, '');
        }
      });
      if (Object.keys(obj).length > 0) rows.push(obj);
    }
  });

  return rows;
}

export async function downloadExcelFile(
  data: Record<string, any>[],
  sheetName: string,
  fileName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length > 0) {
    const keys = Object.keys(data[0]);
    worksheet.columns = keys.map((key) => ({ header: key, key, width: 22 }));
    data.forEach((row) => worksheet.addRow(row));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
