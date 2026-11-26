export type ExportCell = string | number | boolean | null | undefined;

export function csvText(headers: string[], rows: ExportCell[][]) {
    const cell = (value: ExportCell) => {
        let text = value == null ? '' : String(value);
        if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
        return `"${text.replaceAll('"', '""')}"`;
    };
    return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}

export function downloadCsv(name: string, headers: string[], rows: ExportCell[][]) {
    const url = URL.createObjectURL(new Blob([csvText(headers, rows)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
