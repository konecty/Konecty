Meteor.methods
	undoHistory: (meta, historyId, keys, runUpdate) ->
		Meteor.wrapAsync((callback) ->
			console.log "[Server Method] undoHistory (#{meta}, #{historyId}, #{JSON.stringify keys}, #{JSON.stringify runUpdate})"

			metaHistory = "#{meta}.History"
			history = Models[metaHistory].findOne { _id: historyId }
			dataId = history.dataId
			data = Models[meta].findOne _id: dataId

			errors = []
			warnings = []
			infos = []
			for key in keys
				if !history.diffs?[key]?
					errors.push "Chave #{key} não encontrada nas alterações do histórico"
				else
					diff = history.diffs[key]
					if JSON.stringify(data[key]) is JSON.stringify(diff.from)
						infos.push "O valor do campo #{key} no registro já é #{JSON.stringify data[key]}."
					else if JSON.stringify(data[key]) isnt JSON.stringify(diff.to)
						warnings.push "O valor do campo '#{key}' no registro é diferente do valor que está no histórico. Se a alteração for feita, o valor atual #{JSON.stringify data[key]} será alterado para #{JSON.stringify diff.from}."

			if errors.length
				return callback null, { success: false, errors: errors }

			if !runUpdate and warnings.length
				return callback null, { success: false, warnings: warnings }

			if runUpdate
				updateFields = {
					$set: {}
				}

				for key in keys
					updateFields.$set[key] = history.diffs[key].from

				Models[meta].update { _id: dataId }, updateFields, (err, results) ->
					return callback err, { success: true, infos: infos }

			else
				return callback null, { success: false }
		)()