htmlParser = doc => {
  console.log('Documento a ser parseado para HTML ->', doc);
  const parser = new DOMParser();
  return parser.parseFromString(doc, 'text/html');
};
