import { get } from 'lodash';

UI.registerHelper('lengthGt', function(arr, length) {
  return get(arr, 'length', 0) > length;
});
