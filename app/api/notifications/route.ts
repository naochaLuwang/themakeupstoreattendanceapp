import type { NextRequest } from 'next/server';
import { notificationRequest } from '@/lib/notifications/http';
export function GET(request: NextRequest) { return notificationRequest(request); }
export function POST(request: NextRequest) { return notificationRequest(request); }
