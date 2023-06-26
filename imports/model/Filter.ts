import { z } from 'zod';

export const FilterSchema = z.record(z.unknown());

export type Filter = z.infer<typeof FilterSchema>;
