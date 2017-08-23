@Templates = {}

@renderTemplate = (templateId, data) ->
	record = Models['Template'].findOne templateId

	Templates[templateId] =
		template: SSR.compileTemplate(templateId, record.value)
		subject: record.subject

	for name, fn of record.helpers
		helper = {}
		fn = [].concat fn
		helper[name] = Function.apply null, fn
		Template[templateId].helpers helper

	return SSR.render templateId, data
