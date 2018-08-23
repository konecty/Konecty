/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.form = class form extends KonectyComponent {
	static initClass() {
		this.register('Component.form');
	}

	onCreated() {
		this.state = new ReactiveVar('view'); // can be view, edit or insert
		this.errors = new ReactiveVar(undefined);
		this.dirty = new ReactiveVar(false);
		return this.dirtyFields = new ReactiveVar({});
	}

		// Tracker.autorun =>
		// 	dirtyFields = this.dirtyFields.get()
		// 	if Object.keys(dirtyFields).length
		// 		if this.state.curValue is 'view'
		// 			this.state.set('edit')


	record() {
		return Session.get('CurrentRecord');
	}

	getIconChar(label) {
		return Blaze._globalHelpers.i18n(label)[0].toUpperCase();
	}

	tokenize(token) {
		return (token != null ? token.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9]/g, '') : undefined);
	}

	canInsert() {
		return (this.errors.get() == null) && (this.dirty.get() === false);
	}

	canSave() {
		// return @state.get() in ['insert', 'edit']
		return (this.errors.get() == null) && (this.dirty.get() === true);
	}

	canCancel() {
		return this.dirty.get() === true;
	}

	events() { return [{
		"click .control"(e) {
			e.preventDefault();
			e.stopPropagation();
			return Layout.view.toggle();
		},

		"click .alert-a"(e) {
			return Alert.alert({
				title: "Ops!",
				message: "You can't do this.",
				actionText: "Ok",
				onAction: {
					callback() {
						return console.log("CALLBACK");
					}
				}
			});
		},

		"click .alert-b"(e) {
			Alert.set("alertPrompt");
			return Alert.prompt({
				title: "Hi!",
				message: "What was the color of Napoleon's white horse?",
				onAction: {
					waitOn(params, next) {
						const res = (params.value != null ? params.value.match(/^white$/i) : undefined) ? true : false;
						return next(res);
					},
					success: {
						title: "Congratulations!",
						message: "You are awesome."
					},
					fail: {
						title: "Really?!",
						message: "No, this isn't the horse's color."
					}
				},
				onCancel: {}});
		},

		"click .alert-c"(e) {
			return Alert.confirm({
				title: "Delete File",
				message: "Are you sure you want to delete this file?",
				actionText: "Yes",
				cancelText: "No",
				onAction: {
					waitOn(params, next) {
						return setTimeout(() => next(true)
						,500);
					},
					success: {
						title: "Success!",
						message: "Your file is now on your trash folder."
					},
					fail: {
						title: "Error!",
						message: "This is a error message"
					}
				},
				onCancel: {}});
		},

		"click a[group-name]"(e) {
			const groupName = $(e.currentTarget).attr('group-name');
			const template = Template.instance();
			const position = template.$(`li[group-name=${groupName}]`).position();
			const scrollTop = template.$('.wrapper').scrollTop();
			return template.find('.wrapper').scrollTop = position.top + scrollTop;
		},

		"click konecty-button[icon=times]"(e) {
			const template = Template.instance();

			if (template.state.get() === 'edit') {
				const dirtyFields = template.dirtyFields.curValue;
				for (let fieldName in dirtyFields) {
					const value = dirtyFields[fieldName];
					__guardMethod__(template.find(`[name=${fieldName}]`), 'reset', o => o.reset());
				}

			} else if (template.state.get() === 'insert') {
				Session.set('CurrentRecord', undefined);
			}

			return Template.instance().state.set('view');
		},

		"click .new-record"(e) {
			const record = {};
			const object = this.data().meta.document.fields;
			for (let name in object) {
				const field = object[name];
				if (field.defaultValue != null) {
					record[name] = field.defaultValue;
				}
			}

			for (let visual of Array.from(this.data().meta.view.visuals)) {
				if (visual.defaultValue != null) {
					record[visual.name] = visual.defaultValue;
				}
			}

			Session.set('CurrentRecord', record);
			Grid.cleanCurrent();
			return this.state.set('insert');
		},

		"click .cp-button.save"(e) {
			const self = this;

			const value = {};

			for (let child of Array.from(this.componentChildren())) {
				if (child instanceof KonectyFieldComponent) {
					if (child.isDirty != null) {
						if (child.isDirty()) {
							value[child.getName()] = child.getValue();
						}
					} else {
						console.log(child.componentName(), 'has no method isDirty');
						value[child.getName()] = child.getValue();
					}
				}
			}

			for (let k in value) {
				const v = value[k];
				if (v === undefined) {
					value[k] = null;
				}
			}

			console.log(JSON.stringify(value, null, '  '));

			if (Object.keys(value).length > 0) {
				const record = Session.get('CurrentRecord');
				const update = {
					document: this.data().meta.document._id,
					data: {
						ids: [{
							_id: record._id,
							_updatedAt: {
								$date: record._updatedAt.toISOString()
							}
						}],
						data: value
					}
				};

				return Meteor.call('data:update', update, (err, result) => {
					if ((result != null ? result.errors : undefined) != null) {
						console.log(JSON.stringify(result.errors));
						return;
					}

					Session.set('CurrentRecord', Models[this.data().meta.document._id].findOne(record._id));
					return this.state.set('view');
				});
			}
		},

		'value-changed .field > .component'(e) {
			const errors = [];
			let dirty = false;

			for (let child of Array.from(this.componentChildren())) {
				if (child instanceof KonectyFieldComponent) {
					if (child.isValid() !== true) {
						errors.push({
							field: child.getName(),
							message: child.isValid()
						});
					}

					if (child.isDirty()) {
						dirty = true;
					}
				}
			}

			if (errors.length === 0) {
				this.errors.set(undefined);
			} else {
				this.errors.set(errors);
			}

			return this.dirty.set(dirty);
		},

		"dirty [konecty-field]"(e) {
			const field = e.currentTarget;
			const template = Template.instance();
			const dirtyFields = template.dirtyFields.get();

			dirtyFields[field.name] = true;

			return template.dirtyFields.set(dirtyFields);
		},

		"undirty [konecty-field]"(e) {
			const field = e.currentTarget;
			const template = Template.instance();
			const dirtyFields = template.dirtyFields.get();

			delete dirtyFields[field.name];

			return template.dirtyFields.set(dirtyFields);
		}
	}
	]; }
});
Cls.initClass();

function __guardMethod__(obj, methodName, transform) {
  if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
    return transform(obj, methodName);
  } else {
    return undefined;
  }
}