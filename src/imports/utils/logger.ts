import fs from 'fs';
import pino from 'pino';
import pretty from 'pino-pretty';

const level = (process.env.LOG_LEVEL || 'info') as pino.Level;

const stream: pino.StreamEntry[] = [{ level, stream: pretty({ colorize: true, translateTime: 'SYS:standard' }) }];

if (process.env.LOG_TO_FILE) {
	stream.push({ level, stream: fs.createWriteStream(process.env.LOG_TO_FILE, { flags: 'a' }) });
}

export const logger = pino({ level }, pino.multistream(stream));
