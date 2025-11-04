/*!
 * Country Code Utilities for Phone Input
 * Uses libphonenumber-js loaded from CDN
 */

(function () {
	'use strict';

	// Convert country code (ISO 3166-1 alpha-2) to Unicode flag emoji
	// Example: "BR" -> "🇧🇷"
	function countryCodeToUnicodeFlag(countryCode) {
		if (!countryCode || countryCode.length !== 2) {
			return '';
		}
		const codePoints = countryCode
			.toUpperCase()
			.split('')
			.map(char => 127397 + char.charCodeAt(0));
		return String.fromCodePoint(...codePoints);
	}

	// Get default country based on locale
	function getDefaultCountry(locale) {
		if (!locale) {
			return 'BR'; // Default to Brazil
		}
		const normalizedLocale = locale.replace('_', '-').toLowerCase();
		if (normalizedLocale === 'en' || normalizedLocale.startsWith('en-')) {
			return 'US';
		}
		// Default to Brazil for pt-BR, pt_BR, pt, or any other locale
		return 'BR';
	}

	// Get formatted country list with flags, names, and calling codes
	// Returns array of { code, flag, name, callingCode }
	function getCountryList() {
		// libphonenumber-js CDN exposes the library as libphonenumber_js
		const lib = typeof libphonenumber_js !== 'undefined' ? libphonenumber_js : (typeof libphonenumber !== 'undefined' ? libphonenumber : null);
		
		if (!lib || !lib.getCountries) {
			console.error('libphonenumber-js not loaded');
			return [];
		}

		const countries = lib.getCountries();
		
		// Basic country name mapping for common countries (can be extended)
		const countryNames = {
			BR: 'Brazil',
			US: 'United States',
			GB: 'United Kingdom',
			CA: 'Canada',
			MX: 'Mexico',
			AR: 'Argentina',
			CL: 'Chile',
			CO: 'Colombia',
			PE: 'Peru',
			PT: 'Portugal',
			ES: 'Spain',
			FR: 'France',
			DE: 'Germany',
			IT: 'Italy',
			AU: 'Australia',
			NZ: 'New Zealand',
			JP: 'Japan',
			CN: 'China',
			IN: 'India',
		};

		const lib = typeof libphonenumber_js !== 'undefined' ? libphonenumber_js : (typeof libphonenumber !== 'undefined' ? libphonenumber : null);
		
		const countryList = countries.map(function (countryCode) {
			const callingCode = lib ? lib.getCountryCallingCode(countryCode) : '';
			const flag = countryCodeToUnicodeFlag(countryCode);
			// Use country name from mapping or fallback to country code
			const countryName = countryNames[countryCode] || countryCode;

			return {
				code: countryCode,
				flag: flag,
				name: countryName,
				callingCode: callingCode,
			};
		});

		// Sort by country name
		countryList.sort(function (a, b) {
			return a.name.localeCompare(b.name);
		});

		return countryList;
	}

	// Validate phone number by country using libphonenumber-js
	function validatePhoneNumberByCountry(phoneNumber, countryCode) {
		const lib = typeof libphonenumber_js !== 'undefined' ? libphonenumber_js : (typeof libphonenumber !== 'undefined' ? libphonenumber : null);
		
		if (!lib || !lib.isValidPhoneNumber) {
			// Fallback to basic E.164 validation if libphonenumber is not available
			const e164Pattern = /^\+[1-9]\d{1,14}$/;
			return e164Pattern.test(phoneNumber);
		}

		try {
			return lib.isValidPhoneNumber(phoneNumber, countryCode);
		} catch (error) {
			console.error('Error validating phone number:', error);
			// Fallback to E.164
			const e164Pattern = /^\+[1-9]\d{1,14}$/;
			return e164Pattern.test(phoneNumber);
		}
	}

	// Parse phone number and get country code
	function parsePhoneNumber(phoneNumber) {
		const lib = typeof libphonenumber_js !== 'undefined' ? libphonenumber_js : (typeof libphonenumber !== 'undefined' ? libphonenumber : null);
		
		if (!lib || !lib.parsePhoneNumber) {
			return null;
		}

		try {
			const parsed = lib.parsePhoneNumber(phoneNumber);
			if (parsed && parsed.isValid()) {
				return {
					countryCode: parsed.country,
					callingCode: parsed.countryCallingCode,
					nationalNumber: parsed.nationalNumber,
					formatted: parsed.format('E.164'),
				};
			}
		} catch (error) {
			// Invalid phone number
		}

		return null;
	}

	// Combine country code and phone number into E.164 format
	function combineToE164(countryCode, phoneNumber) {
		if (!countryCode || !phoneNumber) {
			return '';
		}

		// Get calling code for the country
		const lib = typeof libphonenumber_js !== 'undefined' ? libphonenumber_js : (typeof libphonenumber !== 'undefined' ? libphonenumber : null);
		
		if (lib && lib.getCountryCallingCode) {
			try {
				const callingCode = lib.getCountryCallingCode(countryCode);
				
				// Clean phone number: remove any existing +, spaces, dashes, parentheses
				var cleanedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
				
				// If phoneNumber already starts with +, try to parse it
				if (cleanedNumber.startsWith('+')) {
					cleanedNumber = cleanedNumber.substring(1);
					// If it starts with the calling code, remove it
					if (cleanedNumber.startsWith(callingCode)) {
						cleanedNumber = cleanedNumber.substring(callingCode.length);
					}
				}
				
				// Remove leading zeros (common in some countries)
				cleanedNumber = cleanedNumber.replace(/^0+/, '');
				
				return '+' + callingCode + cleanedNumber;
			} catch (error) {
				console.error('Error getting calling code for', countryCode, error);
			}
		}

		// Fallback: if phoneNumber already starts with +, return as is
		if (phoneNumber.trim().startsWith('+')) {
			return phoneNumber.trim();
		}

		return '';
	}

	// Export functions to global scope
	window.CountryCodes = {
		countryCodeToUnicodeFlag: countryCodeToUnicodeFlag,
		getDefaultCountry: getDefaultCountry,
		getCountryList: getCountryList,
		validatePhoneNumberByCountry: validatePhoneNumberByCountry,
		parsePhoneNumber: parsePhoneNumber,
		combineToE164: combineToE164,
	};
})();

