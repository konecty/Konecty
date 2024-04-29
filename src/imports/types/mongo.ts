import { z } from 'zod';

const AGGREGATE_STAGES = ['$group', '$match', '$addFields', '$project', '$out', '$unwind', '$count', '$limit', '$sort', '$skip', '$lookup'] as const;

export const AggregatePipeline = z.array(z.record(z.enum(AGGREGATE_STAGES), z.union([z.string(), z.number(), z.record(z.string(), z.any())])));
export type AggregatePipeline = z.infer<typeof AggregatePipeline>;
