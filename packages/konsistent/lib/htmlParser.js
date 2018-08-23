/*
 * decaffeinate suggestions:
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
({
  [this.htmlParser](doc) {
    console.log('Documento a ser parseado para HTML ->', doc);
    const parser = new DOMParser();
    return parser.parseFromString(doc, 'text/html');
  }
});