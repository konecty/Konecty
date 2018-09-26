global.regexUtils = {};

regexUtils.email = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

regexUtils.url = /^http(?:s)?:\/\/(www\.)?[a-z0-9]+(?:[\-\.]{1}[a-z0-9]+)*(?::[0-9]{1,5})?(\/.*)?$/;
