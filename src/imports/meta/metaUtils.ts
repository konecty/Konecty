export function getLabel<T extends { label?: Record<string, string>; name?: string }>(withLabel: T, lang?: string): string {
	const language = lang || 'pt_BR';
	return withLabel.label?.[language] ?? withLabel.label?.en ?? withLabel.name ?? '';
}
