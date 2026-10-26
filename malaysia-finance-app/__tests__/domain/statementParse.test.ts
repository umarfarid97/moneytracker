import { parseStatementAmount, parseStatementCsv, parseStatementDate, parseStatementLines } from '@/domain/statementParse';

describe('parseStatementDate', () => {
  test.each([
    ['2026-10-05', '2026-10-05'],
    ['05/10/2026', '2026-10-05'],
    ['05-10-26', '2026-10-05'],
    ['5.10.2026', '2026-10-05'],
    ['05 Oct 2026', '2026-10-05'],
    ['05-OCT-26', '2026-10-05'],
    ['05 Okt 2026 14:30', '2026-10-05'],
    ['12 Mei', '2026-05-12'],
    ['31/02/2026', null],
    ['hello', null],
  ])('%s', (text, expected) => expect(parseStatementDate(text, 2026)).toBe(expected));
});

describe('parseStatementAmount', () => {
  test.each([
    ['1,234.50', 123450, 0],
    ['RM 12.00', 1200, 0],
    ['(12.00)', 1200, -1],
    ['-12.00', 1200, -1],
    ['12.00-', 1200, -1],
    ['12.00+', 1200, 1],
    ['12.00 DR', 1200, -1],
    ['12.00CR', 1200, 1],
  ])('%s', (text, sen, sign) => expect(parseStatementAmount(text)).toEqual({ sen, sign }));
  test('rejects text and badly grouped numbers', () => {
    expect(parseStatementAmount('abc')).toBeNull();
    expect(parseStatementAmount('12,50')).toBeNull();
  });
});

describe('parseStatementCsv', () => {
  test('separate debit and credit columns (bank style) with preamble rows', () => {
    const csv = [
      'Account Statement,,,',
      'Account: 1234,,,',
      'Date,Description,Debit,Credit,Balance',
      '01/10/2026,"STARBUCKS KLCC, KL",15.90,,984.10',
      '02/10/2026,SALARY OCTOBER,,3000.00,3984.10',
      '03/10/2026,PETRONAS 1234,"1,200.00",,2784.10',
    ].join('\n');
    const rows = parseStatementCsv(csv, 2026);
    expect(rows.map((r) => [r.date, r.amount, r.direction])).toEqual([
      ['2026-10-01', 1590, 'out'],
      ['2026-10-02', 300000, 'in'],
      ['2026-10-03', 120000, 'out'],
    ]);
    expect(rows[0].description).toBe('STARBUCKS KLCC, KL');
  });

  test('one amount column with a sign, semicolons', () => {
    const csv = 'Tarikh;Butiran;Jumlah (RM)\n05/10/2026;GRAB RIDE;-12.50\n06/10/2026;TOP UP;+50.00';
    const rows = parseStatementCsv(csv, 2026);
    expect(rows.map((r) => [r.amount, r.direction])).toEqual([[1250, 'out'], [5000, 'in']]);
  });

  test('unsigned amounts use the running balance, newest first', () => {
    const csv = [
      'Date,Details,Amount,Balance',
      '03/10/2026,Mamak,10.00,90.00',
      '02/10/2026,Friend,50.00,100.00',
      '01/10/2026,Kopi,5.00,50.00',
    ].join('\n');
    const rows = parseStatementCsv(csv, 2026);
    expect(rows.map((r) => r.direction)).toEqual(['out', 'in', 'out']);
  });

  test('e-wallet export with a type column', () => {
    const csv = 'Date,Status,Transaction Type,Description,Amount (RM)\n2026-10-04,Success,Payment,Kopitiam Ah Seng,8.40\n2026-10-04,Success,Reload,Top up,100.00';
    const rows = parseStatementCsv(csv, 2026);
    expect(rows.map((r) => [r.description, r.direction])).toEqual([['Kopitiam Ah Seng', 'out'], ['Top up', 'in']]);
  });

  test('no header: guesses the columns', () => {
    const csv = '01/10/2026,Lunch at mamak,12.00,988.00\n02/10/2026,Petrol shell,50.00,938.00';
    const rows = parseStatementCsv(csv, 2026);
    expect(rows.map((r) => [r.date, r.description, r.amount, r.direction])).toEqual([
      ['2026-10-01', 'Lunch at mamak', 1200, 'out'],
      ['2026-10-02', 'Petrol shell', 5000, 'out'],
    ]);
  });

  test('returns nothing for text that is not a statement', () => {
    expect(parseStatementCsv('hello,world\nfoo,bar', 2026)).toEqual([]);
  });
});

describe('parseStatementLines (PDF text)', () => {
  test('dated lines with amount and balance, wrapped descriptions, balance rows skipped', () => {
    const lines = [
      'Penyata Akaun Statement date 31 Oct 2026',
      'BEGINNING BALANCE 1,000.00',
      '01/10/26 POS DEBIT STARBUCKS 15.90- 984.10',
      'KLCC OUTLET',
      '02/10/26 SALARY 3,000.00+ 3,984.10',
      'Page 1 of 2',
      '03/10/26 TRANSFER TO AHMAD 100.00- 3,884.10',
      'ENDING BALANCE 3,884.10',
    ];
    const rows = parseStatementLines(lines, 2026);
    expect(rows.map((r) => [r.date, r.amount, r.direction, r.balance])).toEqual([
      ['2026-10-01', 1590, 'out', 98410],
      ['2026-10-02', 300000, 'in', 398410],
      ['2026-10-03', 10000, 'out', 388410],
    ]);
    expect(rows[0].description).toBe('POS DEBIT STARBUCKS KLCC OUTLET');
  });

  test('day-month dates take the year from the statement', () => {
    const rows = parseStatementLines(['Statement 2026', '05 OCT GRAB 12.00 DR'], 2025);
    expect(rows[0]).toMatchObject({ date: '2026-10-05', amount: 1200, direction: 'out' });
  });
});
