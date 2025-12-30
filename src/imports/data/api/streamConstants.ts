export const NANOSECONDS_TO_MILLISECONDS = 1_000_000;
export const NEWLINE_SEPARATOR = '\n';
export const MEMORY_MONITOR_INTERVAL_MS = 50;
export const WARMUP_RECORD_LIMIT = 100;
export const ITERATION_DELAY_MS = 2000;
export const MILLISECONDS_PER_SECOND = 1000;
export const MAX_DIFFERENCES_TO_SHOW = 10;
export const MAX_SAMPLE_LENGTH = 100;

// Bluebird concurrency limits
export const BENCHMARK_ITERATION_CONCURRENCY = 3; // Maximum parallel benchmark iterations
export const CONFIDENCE_TEST_CONCURRENCY = 2; // Maximum parallel confidence test executions

// MongoDB read performance optimizations for findStream
// See ADR-0005 for detailed rationale on mandatory secondary node usage
export const STREAM_BATCH_SIZE = 1000; // Optimal batch size for streaming
export const STREAM_MAX_TIME_MS = 300_000; // 5 minutes max query time

