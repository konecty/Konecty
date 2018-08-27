import { createContext, runInContext } from 'vm';
import { compile } from 'coffeescript';

const fn = function() {
  let e;
  const sandbox = createContext({
    Models,
    cb(data) {
      console.log('cb', data);
    }
  });

  let script = `\
exports.contact = Models.Contact.findOne()
exports.candidate = Models.Candidate.findOne()\
`;

  try {
    script = compile(script);
  } catch (error) {
    e = error;
    console.log(e);
  }

  script = `\
var exports = {};
${script}
cb(exports);\
`;

  try {
    runInContext(script, sandbox);
  } catch (error1) {
    e = error1;
    console.log(e);
  }
};
