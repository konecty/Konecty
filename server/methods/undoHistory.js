/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Meteor.methods({
  undoHistory(meta, historyId, keys, runUpdate) {
    return Meteor.wrapAsync(function(callback) {
      console.log(`[Server Method] undoHistory (${meta}, ${historyId}, ${JSON.stringify(keys)}, ${JSON.stringify(runUpdate)})`);

      const metaHistory = `${meta}.History`;
      const history = Models[metaHistory].findOne({ _id: historyId });
      const { dataId } = history;
      const data = Models[meta].findOne({ _id: dataId });

      const errors = [];
      const warnings = [];
      const infos = [];
      for (var key of keys) {
        if ((history.diffs != null ? history.diffs[key] : undefined) == null) {
          errors.push(`Chave ${key} não encontrada nas alterações do histórico`);
        } else {
          const diff = history.diffs[key];
          if (JSON.stringify(data[key]) === JSON.stringify(diff.from)) {
            infos.push(`O valor do campo ${key} no registro já é ${JSON.stringify(data[key])}.`);
          } else if (JSON.stringify(data[key]) !== JSON.stringify(diff.to)) {
            warnings.push(
              `O valor do campo '${key}' no registro é diferente do valor que está no histórico. Se a alteração for feita, o valor atual ${JSON.stringify(
                data[key]
              )} será alterado para ${JSON.stringify(diff.from)}.`
            );
          }
        }
      }

      if (errors.length) {
        return callback(null, { success: false, errors });
      }

      if (!runUpdate && warnings.length) {
        return callback(null, { success: false, warnings });
      }

      if (runUpdate) {
        const updateFields = {
          $set: {}
        };

        for (key of keys) {
          updateFields.$set[key] = history.diffs[key].from;
        }

        return Models[meta].update({ _id: dataId }, updateFields, (err, results) => callback(err, { success: true, infos }));
      } else {
        return callback(null, { success: false });
      }
    })();
  }
});
