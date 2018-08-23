/*
 * decaffeinate suggestions:
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
(function() {
	let forceRedraw = undefined;
	const Cls = (this.Mixin.Transitions = class Transitions {
		static initClass() {
	
			forceRedraw = function(element) {
				const disp = element.style.display;
				element.style.display = 'none';
				const trick = element.offsetHeight;
				element.style.display = disp;
			};
		}

		whichEvent(name) {
			const el = document.createElement('fakeelement');
			const animations = {
				'animation': name + 'end',
				'WebkitAnimation': `webkit${name.charAt(0).toUpperCase()}${name.slice(1)}End`
			};

			for (let a in animations) {
				if (el.style[a] !== undefined) {
					return animations[a];
				}
			}
			return "";
		}
	});
	Cls.initClass();
	return Cls;
})();