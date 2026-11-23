/** Attendance and shift days follow the store's timezone, including before 05:30 UTC. */
export function getAttendanceDate(date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
}
