import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync('lib/attendance/schedule.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledModule = { exports: {} };
vm.runInNewContext(`(function(module,exports){${compiled}\n})(compiledModule,compiledModule.exports)`, { compiledModule, Date, Intl });
const { addScheduleDays, weekDates, calendarRange, calendarDay, scheduleDateLabel, workedDuration, attendanceTime, shiftCoversInstant } = compiledModule.exports;
const shift = { id: 'shift-a', start_time: '2026-11-24T10:00:00Z', end_time: '2026-11-24T18:00:00Z', shift_label: 'Day shift', attendance_started_at: '2026-11-24T04:30:00Z' };

test('week selection crosses year boundaries with seven consecutive Monday-first dates', () => {
    const dates = [...weekDates('2027-01-01')];
    assert.equal(dates.length, 7);
    assert.equal(dates[0], '2026-12-28');
    assert.equal(dates[6], '2027-01-03');
    assert.equal(new Date(dates[0]).getUTCDay(), 1);
    assert.equal(addScheduleDays('2028-02-28', 1), '2028-02-29');
});

test('month query covers every displayed date with an exclusive next-day boundary', () => {
    for (const [year, month] of [[2026, 10], [2026, 11], [2027, 0], [2028, 1]]) {
        const range = calendarRange(year, month);
        assert.equal(range.dates.length % 7, 0);
        assert.equal(range.dates[0], range.start);
        assert.equal(addScheduleDays(range.dates.at(-1), 1), range.end);
        assert.equal(new Date(range.start).getUTCDay(), 1);
        for (let day = 1; day <= new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); day++) {
            assert.ok(range.dates.includes(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`));
        }
    }
});

test('schedule keeps legacy wall-clock hours while actual attendance formats in IST', () => {
    const day = calendarDay('2026-11-24', [shift], []);
    assert.equal(day.start.time, '10:00');
    assert.equal(day.end.time, '6:00');
    assert.equal(day.end.period, 'PM');
    assert.equal(day.locked, true);
    assert.match(attendanceTime('2026-11-24T04:30:00Z'), /10:00/);
    assert.match(scheduleDateLabel('2026-11-24'), /24 Nov/);
});

test('approved leave overlap includes the first and last day without affecting other dates', () => {
    const leave = [{ start_date: '2026-11-23', end_date: '2026-11-24' }];
    assert.equal(calendarDay('2026-11-23', [], leave).isLeave, true);
    assert.equal(calendarDay('2026-11-24', [shift], leave).isLeave, true);
    assert.equal(calendarDay('2026-11-25', [], leave).isLeave, false);
});

test('requests follow their full date or shift id, including adjacent months with the same day number', () => {
    const request = { id: 'request-a', shift_id: shift.id, status: 'pending', message: 'Shift change for 2026-11-24' };
    assert.equal(calendarDay('2026-11-24', [shift], [], [request]).request.id, request.id);
    assert.equal(calendarDay('2026-12-24', [], [], [request]).request, null);
    assert.equal(calendarDay('2026-11-24', [shift], [], [{ ...request, status: 'cancelled' }]).request, null);
});

test('completed duration uses actual server timestamps and never invents a checkout', () => {
    assert.equal(workedDuration({ check_in: '2026-11-24T04:30:00Z', check_out: '2026-11-24T12:33:40Z' }), '8h 03m');
    assert.equal(workedDuration({ check_in: '2026-11-24T04:30:00Z', check_out: null }), null);
    assert.equal(workedDuration({ check_in: '2026-11-24T04:30:00Z', check_out: '2026-11-24T03:30:00Z' }), null);
});

test('overnight eligibility converts roster wall times to store instants without changing saved schedules', () => {
    const overnight = { start_time: '2026-11-23T22:00:00Z', end_time: '2026-11-24T06:00:00Z' };
    assert.equal(shiftCoversInstant(overnight, new Date('2026-11-23T20:00:00Z')), true);
    assert.equal(shiftCoversInstant(overnight, new Date('2026-11-24T00:30:00Z')), false);
    assert.equal(shiftCoversInstant({ ...overnight, end_time: '2026-11-23T06:00:00Z' }, new Date('2026-11-23T20:00:00Z')), true);
    assert.equal(shiftCoversInstant({ ...overnight, end_time: null }, new Date('2026-11-23T20:00:00Z')), false);
});
