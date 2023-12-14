import { z } from 'zod';

export const LabelSchema = z.record(z.string());

export type Label = z.infer<typeof LabelSchema>;
