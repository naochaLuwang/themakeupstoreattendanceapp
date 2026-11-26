import { z } from 'zod';
import { INSPECTION_STATUSES, DAMAGE_TYPES, TASK_PRIORITIES, TASK_CATEGORIES, INCIDENT_TYPES, TESTER_CONDITIONS } from './constants';
import { mediaPath, MAX_IMAGES } from './media';

export const uuid = z.uuid();
export const optionalText = z.string().trim().max(5000).nullish();
export const imageUrls = z.array(z.string().max(2048).refine(url => mediaPath(url) !== null, 'Invalid photo reference')).max(MAX_IMAGES).optional();
export const shelfSchema = z.object({ section_id: uuid, status: z.enum(INSPECTION_STATUSES), notes: optionalText, image_urls: imageUrls });
export const damageSchema = z.object({ store_id: uuid.optional(), barcode: z.string().trim().min(1).max(100), product_name: z.string().trim().min(1).max(200), brand: optionalText, shade: optionalText, batch: optionalText, mrp: z.number().finite().min(0).optional(), quantity: z.number().int().min(1).max(100000), damage_type: z.enum(DAMAGE_TYPES), description: optionalText, image_urls: imageUrls });
export const taskSchema = z.object({ store_id: uuid.optional(), title: z.string().trim().min(1).max(200), description: optionalText, assigned_to: uuid.optional(), priority: z.enum(TASK_PRIORITIES), due_date: z.iso.datetime({ offset: true }).optional(), category: z.enum(TASK_CATEGORIES).optional(), is_recurring: z.boolean().optional(), recurrence_rule: z.enum(['daily','weekly','monthly']).optional() }).refine(data => !data.is_recurring || !!data.recurrence_rule, 'Choose a recurrence interval.');
export const incidentSchema = z.object({ store_id: uuid.optional(), title: z.string().trim().min(1).max(200), description: optionalText, incident_type: z.enum(INCIDENT_TYPES), priority: z.enum(TASK_PRIORITIES).default('medium'), image_urls: imageUrls, voice_note_url: z.string().max(2048).optional() });
export const testerSchema = z.object({ store_id: uuid.optional(), product_name: z.string().trim().min(1).max(200), brand: optionalText, shade: optionalText, opened_date: z.iso.date().optional(), expiry_date: z.iso.date().optional(), condition: z.enum(TESTER_CONDITIONS), remaining_percentage: z.number().int().min(0).max(100), needs_replacement: z.boolean().optional() }).refine(data => !data.opened_date || !data.expiry_date || data.opened_date <= data.expiry_date, 'Expiry must be after the opened date.');

export function validationMessage(error: z.ZodError): string { return error.issues[0]?.message || 'Check the form and try again.'; }
