class @Mixin.Transitions

	whichEvent: (name) ->
		el = document.createElement('fakeelement')
		animations =
			'animation': name + 'end',
			'WebkitAnimation': 'webkit' + name.charAt(0).toUpperCase() + name.slice(1) + 'End'

		for a of animations
			if el.style[a] != undefined
				return animations[a]
		return ""

	forceRedraw = (element) ->
		disp = element.style.display
		element.style.display = 'none'
		trick = element.offsetHeight
		element.style.display = disp
		return