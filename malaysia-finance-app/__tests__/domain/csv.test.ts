import { csvCell, toCsv } from '@/domain/csv';

describe('csvCell', () => {
  test('plain text and numbers are left alone', () => {
    expect(csvCell('Klinik')).toBe('Klinik');
    expect(csvCell(1250)).toBe('1250');
    expect(csvCell(-5)).toBe('-5');
  });
  test('commas, quotes and line breaks are wrapped in quotes with quotes doubled', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
  test('text a spreadsheet would run as a formula is neutralised', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tcmd')).toBe("'\tcmd");
  });
  test('a dash or plus that is just a word is still safe to read', () => {
    expect(csvCell('-')).toBe("'-");
  });
});

describe('toCsv', () => {
  test('joins cells with commas and rows with CRLF', () => {
    expect(toCsv([['Date', 'Note'], ['2026-10-24', 'a,b'], [1, 'x']])).toBe('Date,Note\r\n2026-10-24,"a,b"\r\n1,x');
  });
  test('empty input is an empty string', () => {
    expect(toCsv([])).toBe('');
  });
});
