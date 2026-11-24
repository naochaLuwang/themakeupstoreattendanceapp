import { attendancePost } from '@/lib/attendance/http';
export const POST = (request: Request) => attendancePost(request, 'clock_out');
