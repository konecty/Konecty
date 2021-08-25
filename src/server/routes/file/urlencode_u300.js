import reduce from 'lodash/reduce';

const fixedEncodeURIComponent = str =>
	String(str)
		.replace(/[^ !'()~*]/gu, encodeURIComponent)
		.replace(/ /g, '+')
		.replace(/[!'()~*]/g, ch => `%${ch.charCodeAt().toString(16).slice(-2).toUpperCase()}`);

export default str => {
	if (str == null || str === '') {
		return '';
	}

	const encoded = fixedEncodeURIComponent(str);

	const U300_ACCENT = {
		GRAVE: '%CC%80',
		// U+0301	́
		ACUTE: '%CC%81',
		// U+0302	̂
		CIRCUMFLEX: '%CC%82',
		// U+0303	̃
		TILDE: '%CC%83',
		// U+0304	̄
		MACRON: '%CC%84',
		// U+0305	̅
		OVERLINE: '%CC%85',
		// U+0306	̆
		BREVE: '%CC%86',
		// U+0307	̇
		'DOT ABOVE': '%CC%87',
		// U+0308	̈
		DIAERESIS: '%CC%88',
		// U+0309	̉
		'HOOK ABOVE': '%CC%89',
		// U+030A	̊
		'RING ABOVE': '%CC%8a',
		// U+030B	̋
		'DOUBLE ACUTE': '%CC%8b',
		// U+030C	̌
		CARON: '%CC%8c',
		// U+030D	̍
		'VERTICAL LINE ABOVE': '%CC%8d',
		// U+030E	̎
		'DOUBLE VERTICAL LINE ABOVE': '%CC%8e',
		// U+030F	̏
		'DOUBLE GRAVE': '%CC%8f',
		// U+0310	̐
		CANDRABINDU: '%CC%90',
		// U+0311	̑
		'INVERTED BREVE': '%CC%91',
		// U+0312	̒
		'TURNED COMMA ABOVE': '%CC%92',
		// U+0313	̓
		'COMMA ABOVE': '%CC%93',
		// U+0314	̔
		'REVERSED COMMA ABOVE': '%CC%94',
		// U+0315	̕
		'COMMA ABOVE RIGHT': '%CC%95',
		// U+0316	̖
		'GRAVE BELOW': '%CC%96',
		// U+0317	̗
		'ACUTE BELOW': '%CC%97',
		// U+0318	̘
		'LEFT TACK BELOW': '%CC%98',
		// U+0319	̙
		'RIGHT TACK BELOW': '%CC%99',
		// U+031A	̚
		'LEFT ANGLE ABOVE': '%CC%9a',
		// U+031B	̛
		HORN: '%CC%9b',
		// U+031C	̜
		'LEFT HALF RING BELOW': '%CC%9c',
		// U+031D	̝
		'UP TACK BELOW': '%CC%9d',
		// U+031E	̞
		'DOWN TACK BELOW': '%CC%9e',
		// U+031F	̟
		'PLUS SIGN BELOW': '%CC%9f',
		// U+0320	̠
		'MINUS SIGN BELOW': '%CC%a0',
		// U+0321	̡
		'PALATALIZED HOOK BELOW': '%CC%a1',
		// U+0322	̢
		'RETROFLEX HOOK BELOW': '%CC%a2',
		// U+0323	̣
		'DOT BELOW': '%CC%a3',
		// U+0324	̤
		'DIAERESIS BELOW': '%CC%a4',
		// U+0325	̥
		'RING BELOW': '%CC%a5',
		// U+0326	̦
		'COMMA BELOW': '%CC%a6',
		// U+0327	̧
		CEDILLA: '%CC%a7',
	};

	const ENCODED_ACCENTS = {
		// U+00C0	À
		'%C3%80': ['A', 'GRAVE'],
		// U+00C1	Á
		'%C3%81': ['A', 'ACUTE'],
		// U+00C2	Â
		'%C3%82': ['A', 'CIRCUMFLEX'],
		// U+00C3	Ã
		'%C3%83': ['A', 'TILDE'],
		// U+00C4	Ä
		'%C3%84': ['A', 'DIAERESIS'],
		// U+00C5	Å
		'%C3%85': ['A', 'RING ABOVE'],
		// U+00C7	Ç
		'%C3%87': ['C', 'CEDILLA'],
		// U+00C8	È
		'%C3%88': ['E', 'GRAVE'],
		// U+00C9	É
		'%C3%89': ['E', 'ACUTE'],
		// U+00CA	Ê
		'%C3%8a': ['E', 'CIRCUMFLEX'],
		// U+00CB	Ë
		'%C3%8b': ['E', 'DIAERESIS'],
		// U+00CC	Ì
		'%C3%8c': ['I', 'GRAVE'],
		// U+00CD	Í
		'%C3%8d': ['I', 'ACUTE'],
		// U+00CE	Î
		'%C3%8e': ['I', 'CIRCUMFLEX'],
		// U+00CF	Ï
		'%C3%8f': ['I', 'DIAERESIS'],
		// U+00D1	Ñ
		'%C3%91': ['N', 'TILDE'],
		// U+00D2	Ò
		'%C3%92': ['O', 'GRAVE'],
		// U+00D3	Ó
		'%C3%93': ['O', 'ACUTE'],
		// U+00D4	Ô
		'%C3%94': ['O', 'CIRCUMFLEX'],
		// U+00D5	Õ
		'%C3%95': ['O', 'TILDE'],
		// U+00D6	Ö
		'%C3%96': ['O', 'DIAERESIS'],
		// U+00D9	Ù
		'%C3%99': ['U', 'GRAVE'],
		// U+00DA	Ú
		'%C3%9a': ['U', 'ACUTE'],
		// U+00DB	Û
		'%C3%9b': ['U', 'CIRCUMFLEX'],
		// U+00DC	Ü
		'%C3%9c': ['U', 'DIAERESIS'],
		// U+00DD	Ý
		'%C3%9d': ['Y', 'ACUTE'],
		// U+00E0	à
		'%C3%a0': ['a', 'GRAVE'],
		// U+00E1	á
		'%C3%a1': ['a', 'ACUTE'],
		// U+00E2	â
		'%C3%a2': ['a', 'CIRCUMFLEX'],
		// U+00E3	ã
		'%C3%a3': ['a', 'TILDE'],
		// U+00E4	ä
		'%C3%a4': ['a', 'DIAERESIS'],
		// U+00E5	å
		'%C3%a5': ['a', 'RING ABOVE'],
		// U+00E7	ç
		'%C3%a7': ['c', 'CEDILLA'],
		// U+00E8	è
		'%C3%a8': ['e', 'GRAVE'],
		// U+00E9	é
		'%C3%a9': ['e', 'ACUTE'],
		// U+00EA	ê
		'%C3%aa': ['e', 'CIRCUMFLEX'],
		// U+00EB	ë
		'%C3%ab': ['e', 'DIAERESIS'],
		// U+00EC	ì
		'%C3%ac': ['i', 'GRAVE'],
		// U+00ED	í
		'%C3%ad': ['i', 'ACUTE'],
		// U+00EE	î
		'%C3%ae': ['i', 'CIRCUMFLEX'],
		// U+00EF	ï
		'%C3%af': ['i', 'DIAERESIS'],
		// U+00F1	ñ
		'%C3%b1': ['n', 'TILDE'],
		// U+00F2	ò
		'%C3%b2': ['o', 'GRAVE'],
		// U+00F3	ó
		'%C3%b3': ['o', 'ACUTE'],
		// U+00F4	ô
		'%C3%b4': ['o', 'CIRCUMFLEX'],
		// U+00F5	õ
		'%C3%b5': ['o', 'TILDE'],
		// U+00F6	ö
		'%C3%b6': ['o', 'DIAERESIS'],
		// U+00F9	ù
		'%C3%b9': ['u', 'GRAVE'],
		// U+00FA	ú
		'%C3%ba': ['u', 'ACUTE'],
		// U+00FB	û
		'%C3%bb': ['u', 'CIRCUMFLEX'],
		// U+00FC	ü
		'%C3%bc': ['u', 'DIAERESIS'],
		// U+00FD	ý
		'%C3%bd': ['y', 'ACUTE'],
		// U+00FF	ÿ
		'%C3%bf': ['y', 'DIAERESIS'],
	};

	return reduce(
		ENCODED_ACCENTS,
		(acc, v, k) => {
			if (acc.includes(k)) {
				const [l, a] = v;
				const accent = U300_ACCENT[a];
				return acc.split(k).join(`${l}${accent}`);
			}
			return acc;
		},
		encoded,
	);
};
