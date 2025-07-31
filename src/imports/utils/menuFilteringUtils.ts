import { MetaAccess } from '../model/MetaAccess';

/**
 * Checks if a list should be filtered from the menu based on access configuration
 * @param access - The access configuration object
 * @param listName - The name of the list to check
 * @returns true if the list should be filtered, false otherwise
 */
export function shouldFilterListFromMenu(access: MetaAccess, listName: string): boolean {
	if (!access.hideListsFromMenu || access.hideListsFromMenu.length === 0) {
		return false;
	}
	return access.hideListsFromMenu.includes(listName);
}

/**
 * Checks if a pivot should be filtered from the menu based on access configuration
 * @param access - The access configuration object
 * @param pivotName - The name of the pivot to check
 * @returns true if the pivot should be filtered, false otherwise
 */
export function shouldFilterPivotFromMenu(access: MetaAccess, pivotName: string): boolean {
	if (!access.hidePivotsFromMenu || access.hidePivotsFromMenu.length === 0) {
		return false;
	}
	return access.hidePivotsFromMenu.includes(pivotName);
}

/**
 * Checks if a meta object should be filtered from the menu based on access configuration
 * @param access - The access configuration object
 * @param metaObject - The meta object to check
 * @returns true if the meta object should be filtered, false otherwise
 */
export function shouldFilterMetaObjectFromMenu(access: MetaAccess, metaObject: { type: string; name: string }): boolean {
	if (metaObject.type === 'list') {
		return shouldFilterListFromMenu(access, metaObject.name);
	}
	if (metaObject.type === 'pivot') {
		return shouldFilterPivotFromMenu(access, metaObject.name);
	}
	return false;
}

/**
 * Applies menuSorter override from access configuration
 * @param access - The access configuration object
 * @param moduleName - The name of the module/document
 * @param originalMenuSorter - The original menuSorter value from the module
 * @returns The menuSorter value to use (overridden or original)
 */
export function getMenuSorterFromAccess(access: MetaAccess, moduleName: string, originalMenuSorter: number): number {
	if (!access.menuSorter || !(moduleName in access.menuSorter)) {
		return originalMenuSorter;
	}
	return access.menuSorter[moduleName];
}
