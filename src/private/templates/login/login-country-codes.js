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
		if (typeof libphonenumber === 'undefined' || !libphonenumber.getCountries) {
			console.error('libphonenumber-js not loaded');
			return [];
		}

		const countries = libphonenumber.getCountries();
		const countryList = countries.map(function (countryCode) {
			const callingCode = libphonenumber.getCountryCallingCode(countryCode);
			const flag = countryCodeToUnicodeFlag(countryCode);
			// Get country name from locale (if available) or use country code
			const countryName =
				libphonenumber.getCountryName && typeof libphonenumber.getCountryName === 'function' ? libphonenumber.getCountryName(countryCode, 'en') : countryCode;

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
		if (typeof libphonenumber === 'undefined' || !libphonenumber.isValidPhoneNumber) {
			// Fallback to basic E.164 validation if libphonenumber is not available
			const e164Pattern = /^\+[1-9]\d{1,14}$/;
			return e164Pattern.test(phoneNumber);
		}

		try {
			return libphonenumber.isValidPhoneNumber(phoneNumber, countryCode);
		} catch (error) {
			console.error('Error validating phone number:', error);
			// Fallback to E.164
			const e164Pattern = /^\+[1-9]\d{1,14}$/;
			return e164Pattern.test(phoneNumber);
		}
	}

	// Parse phone number and get country code
	function parsePhoneNumber(phoneNumber) {
		if (typeof libphonenumber === 'undefined' || !libphonenumber.parsePhoneNumber) {
			return null;
		}

		try {
			const parsed = libphonenumber.parsePhoneNumber(phoneNumber);
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

		// Remove any existing + or country code from phoneNumber
		var cleanedNumber = phoneNumber.replace(/^\+/, '').replace(/^\d{1,3}/, '');

		// Get calling code for the country
		if (typeof libphonenumber !== 'undefined' && libphonenumber.getCountryCallingCode) {
			try {
				const callingCode = libphonenumber.getCountryCallingCode(countryCode);
				return '+' + callingCode + cleanedNumber;
			} catch (error) {
				console.error('Error getting calling code for', countryCode, error);
			}
		}

		// Fallback: if phoneNumber already starts with +, return as is
		if (phoneNumber.startsWith('+')) {
			return phoneNumber;
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
