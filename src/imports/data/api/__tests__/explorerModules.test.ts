import { getExplorerModules } from '../explorerModules';
import { MetaObject } from '@imports/model/MetaObject';
import * as accessUtils from '@imports/utils/accessUtils';

jest.mock('@imports/model/MetaObject', () => ({
	MetaObject: {
		Meta: {},
	},
}));

jest.mock('@imports/utils/accessUtils');
jest.mock('@imports/meta/metaUtils', () => ({
	getLabel: (obj: { label?: Record<string, string>; name?: string }, lang?: string) => {
		const language = lang ?? 'pt_BR';
		return obj.label?.[language] ?? obj.label?.en ?? obj.name ?? '';
	},
}));

const mockGetAccessFor = accessUtils.getAccessFor as jest.MockedFunction<typeof accessUtils.getAccessFor>;
const mockGetFieldPermissions = accessUtils.getFieldPermissions as jest.MockedFunction<typeof accessUtils.getFieldPermissions>;

const mockUser = { name: 'Test User', _id: 'user1' } as any;

describe('getExplorerModules', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(MetaObject.Meta as any) = {};
	});

	it('returns empty modules when no meta', () => {
		const result = getExplorerModules(mockUser, 'pt_BR');
		expect(result.modules).toEqual([]);
	});

	it('returns queryable modules with readable access', () => {
		(MetaObject.Meta as any) = {
			Contact: {
				type: 'document',
				name: 'Contact',
				label: { pt_BR: 'Contato', en: 'Contact' },
				fields: {
					name: { type: 'text', name: 'name', label: { pt_BR: 'Nome', en: 'Name' } },
					email: { type: 'email', name: 'email', label: { pt_BR: 'E-mail', en: 'Email' } },
				},
			},
		};

		mockGetAccessFor.mockReturnValue({ isReadable: true } as any);
		mockGetFieldPermissions.mockReturnValue({ isReadable: true } as any);

		const result = getExplorerModules(mockUser, 'pt_BR');
		expect(result.modules).toHaveLength(1);
		expect(result.modules[0].document).toBe('Contact');
		expect(result.modules[0].label).toBe('Contato');
		expect(result.modules[0].fields).toHaveLength(2);
	});

	it('skips modules without read access', () => {
		(MetaObject.Meta as any) = {
			Secret: {
				type: 'document',
				name: 'Secret',
				label: { en: 'Secret' },
				fields: {},
			},
		};

		mockGetAccessFor.mockReturnValue(false);

		const result = getExplorerModules(mockUser);
		expect(result.modules).toEqual([]);
	});

	it('skips non-queryable types', () => {
		(MetaObject.Meta as any) = {
			Temp: {
				type: 'simple',
				name: 'Temp',
				label: { en: 'Temp' },
				fields: {},
			},
		};

		mockGetAccessFor.mockReturnValue({ isReadable: true } as any);

		const result = getExplorerModules(mockUser);
		expect(result.modules).toEqual([]);
	});

	it('skips fields without read permission', () => {
		(MetaObject.Meta as any) = {
			Contact: {
				type: 'document',
				name: 'Contact',
				label: { en: 'Contact' },
				fields: {
					name: { type: 'text', name: 'name', label: { en: 'Name' } },
					secret: { type: 'text', name: 'secret', label: { en: 'Secret' } },
				},
			},
		};

		mockGetAccessFor.mockReturnValue({ isReadable: true } as any);
		mockGetFieldPermissions.mockImplementation((_access, fieldName) => {
			if (fieldName === 'secret') return { isReadable: false } as any;
			return { isReadable: true } as any;
		});

		const result = getExplorerModules(mockUser, 'en');
		expect(result.modules[0].fields).toHaveLength(1);
		expect(result.modules[0].fields[0].name).toBe('name');
	});

	it('detects reverse lookups', () => {
		(MetaObject.Meta as any) = {
			Contact: {
				type: 'document',
				name: 'Contact',
				label: { en: 'Contact' },
				fields: {},
			},
			Opportunity: {
				type: 'document',
				name: 'Opportunity',
				label: { en: 'Opportunity' },
				fields: {
					contact: { type: 'lookup', name: 'contact', document: 'Contact', label: { en: 'Contact' } },
				},
			},
		};

		mockGetAccessFor.mockReturnValue({ isReadable: true } as any);
		mockGetFieldPermissions.mockReturnValue({ isReadable: true } as any);

		const result = getExplorerModules(mockUser, 'en');
		const contactModule = result.modules.find(m => m.document === 'Contact');
		expect(contactModule!.reverseLookups).toHaveLength(1);
		expect(contactModule!.reverseLookups[0].document).toBe('Opportunity');
		expect(contactModule!.reverseLookups[0].lookup).toBe('contact');
	});
});
