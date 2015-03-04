var fs = require('fs');
var path = require('path');
var parseArgs = require('minimist');
var _ = require('lodash');

function usage() {
	console.log('Usage: selenium2casper.js [-l|--lint] [-h|--help] selenium-file');
}
var defaults = { 'lint': false, 'help': false };
var args = parseArgs(process.argv, { 'defaults': defaults, 'boolean': ['lint', 'help'] });

if ( args['help'] || args['h']) {
	usage();
	process.exit(1);
}

var file2read = args._[2];
var testsString = '';

var contents = fs.readFileSync(file2read, 'utf8');

var re = /<tr>\s*<td>(\w{1,})<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<\/tr>/g;
var m;
var errorCount = 0;
var warningCount = 0;

/**
 * This function determines which commands have been implemented. 
 * It does this by searching the directory where the templates are
 * stored and looking for files ending with '_cmd_impl.js' (this
 * could be changed -- see the cmdTemplateEnd variable). If the
 * file exists, the command is assumed to be implemented.
 * 
 * @param  path { string } path 	- the directory name to sarch
 * @return { object } containing names of implemented commands.
 */
function getImplementedCommands(path) {
	var files = fs.readdirSync(path);
	var commands = [];
	var cmdTemplateEnd = '_cmd_impl.js';
	files.forEach(function(file, index, array) {
		if ( _.endsWith(file, cmdTemplateEnd) ) {
			commands.push(file.substr(0, file.length - cmdTemplateEnd.length));
		}
	});
	return commands;

}
var implementedCommands = getImplementedCommands('templates');

function getAllCommands() {
	var cmds = fs.readFileSync('templates/commandlist.txt', 'utf8');
	return cmds.split('\n');
}

var allCommands = getAllCommands();

/**
 * Determines if the command is known, but currently does not have
 * an implementation or not.
 * 
 * 		@param { string } command 	- a Selenium command.
 *		@return { Boolean } 		- True if the command is unimplemented presently and false otherwise
 */
function isImplementedCommand(command) {
	return implementedCommands.indexOf(command) >= 0;
}

function isDefinedCommand(command) {
	return allCommands.indexOf(command) >= 0;
}

/**
 * Read the template containing standard declarations and setup that all casperjs scripts need
 * to run.
 * 
 * @param  { string }	fileName 	- the filename of the original Selenium IDE script being converted.
 * @param  { Number }	testCount 	- the number of tests in the CasperJS output.
 * @return { string } A string containing the standard declarations.
 */
function getStandardDefinitions(fileName, testCount) {
	var testName = path.basename(fileName).split('.')[0]
	var date = new Date();

	compile = _.template(fs.readFileSync('templates/common_start.js'));
	return compile({ 'fileName': fileName, 'testName': testName, 'date': date, 'testCount': testCount });
}

function getClosingStatements() {
	compile = _.template(fs.readFileSync('templates/common_end.js'));
	return compile({ });
}

function getMessaging(warningCount, errorCount) {
	compile = _.template(fs.readFileSync('templates/messaging.js'));
	return compile({ 'warningCount': warningCount, 'errorCount': errorCount });
}

// replaceVarReferences:
//     parse a string value, locating variable references such as "${branch}"
//     and substituting logic necessary to find the variable's value at runtime.
//
// Arguments:
//    str - string value to parse. Can constain any number of variable references.
//
// Returns:
//    A string with all variable references replaced with values.
function replaceVarReferences(str) {
    var re = /([^\$]*)\${([^}]{1,})}(.*)/;
    var m;
    var result = str;

    // This loops until we run out of matches.
    while ((m = re.exec(result)) != null) {
    	if (m.index === re.lastIndex) {
			re.lastIndex++;
	    }
    	// View your result using the m-variable.
    	// eg m[0] etc.
    	if ( m[1] && m[3] ) {
    		result = '\'' + m[1] + '\' + utils.get(\'' + m[2] + '\') + \'' + m[3] + '\'';
    	} else if ( m[1] ) {
    		result = '\'' + m[1] + '\' + utils.get(\'' + m[2] + '\')';
    	} else if ( m[3] ) {
    		result = 'utils.get(\'' + m[2] + '\') + \'' + m[3] + '\'';
    	} else {
    		result = 'utils.get(\'' + m[2] + '\')';
    	}
    }
    return result;
}

/**
 * replaceHtmlEntities
 *
 * @param { string } str 	A string value
 * @return { string }		The string value with its html entities replaced with their ASCII string values.
 */
function replaceHtmlEntities(str) {
	return String(str).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}
/**
 * parseTarget:
 *
 *	Parses a target value, looking for:
 *		1. an xpath reference (starts with '//').
 *		2. an equals ('=') sign which will indicate some variety of CSS selector.
 *
 * Argument:
 *	@param { string } str 	String value to parse. If the string is a CSS selector, it should be of the form key=value.
 *							If it's an xpath reference, it will start with '//'.
 *  @return { object }		An associative array with two keys: 'key' and 'value'.
 *							If str contains a CSS selector, { 'key': key, 'value': value }
 *							If str contains an xpath, {'key': 'xpath', 'value': value }
 *							If str does not contain a CSS selector, { 'key': '', 'value': value }
 */
function parseTarget(str) {
	var result = {};
	if ( str.charAt(0) === '/' && str.charAt(1) === '/' ) {
		result['key'] = 'xpath';
		result['value'] = str;
	} else if ( str.indexOf('=') >= 0 ) {
		var parts = str.split('=');
		result['key'] = replaceHtmlEntities(parts.shift());

		result['value']= replaceHtmlEntities(parts.join('='));		// we have to do the join just in case there are additional equal signs.
	} else {
		result['key'] = '';
		result['value']= replaceHtmlEntities(str);
	}
	return result;

}

/**
 * parseValue:
 *
 *	Similiar to parse, except this function parses a value. It looks for
 *	pattern matching keywords. I.e., "exact:", "glob:", "regexpi:", or "regexp:".
 *
 * Argument:
 *	@param { string } str 	String value to parse.
 *  @return { object }		An associative array with two keys: 'searchType' and 'value'.
 *							If str contains a pattern matching keyword, { 'searchType': searchType, 'value': value }
 *							If str does not contain a pattern matching keyword, { 'searchType': '', 'value': value }
 */
function parseValue(str) {
	var result = {};
	if ( _.startsWith(str, 'exact:') ) {
		result['searchType'] = 'exact';
		result['value'] = replaceHtmlEntities(str).substr(6);
	} else if ( _.startsWith(str, 'regexpi:') ) {
		result['searchType'] = 'regexpi';
		result['value'] = replaceHtmlEntities(str).substr(8);
	} else if ( _.startsWith(str, 'regexp:') ) {
		result['searchType'] = 'regexp';
		result['value'] = replaceHtmlEntities(str).substr(7);
	} else if ( _.startsWith(str, 'glob:') ) {
		result['searchType'] = '';
		result['value'] = replaceHtmlEntities(str).substr(5);
	} else {
		result['searchType'] = '';
		result['value']= replaceHtmlEntities(str);
	}
	return result;

}

/**
 * Add escape character ('\') to a string in preparation for enclosing it with quotes.
 * 
 * @param { string } str 	A string
 * @return { string }		String with embedded quotes escaped.
 */
function escapeEmbeddedQuotes(str) {
	if ( str.indexOf('\'') >= 0 ) {
		str = str.replace(/\'/g, '\\\'');
	}
	return str;
}

/**
 * Adds quotation marks (single) to a string.
 * 
 * @param { string } str 	A string to quote.
 * @return { string }		Quoted string.
 */
function addQuotes(str) {
	return '\'' + escapeEmbeddedQuotes(str) +  '\'';
}

/**
 * isLiteral
 *
 * Checks to see if the string represents just a string (a literal) or if it
 * contains a references to a configuration variable whose value must be obtained
 * at test runtime.
 * 
 * 		@param { string } str 	a string value
 * 		@return { boolean } 	true if str is a literal string value and 
 * 								false if the string contains a reference to a
 * 								variable whose value must be obtained at runtime.
 */
function isLiteral(str) {
	return str.indexOf('utils.get') === -1;
}

/**
 * Processes a single Selenium command into equivalent CasperJS commands
 * Arguments:
 * 		@param { string } command 	a Selenium command
 * 		@param { string } target 	the command target
 * 		@param { value }  value 	the command value
 * 		@return { object } Returns an associative array object containing the following keys:
 * 		<ul>
 * 		<li><em>tests</em>: A string containing CasperJS commands
 * 		<li><em>testCount</em>: The count of assertions in the tests.
 * 		<li><em>errorCount</em>: A count of errors that occurred.
 * 		<li><em>warningCount</em>: A count of warnings.
 * 		</ul>
 *
 */

function processStep(command, target, value) {
	var testString = '';
	var testCount = 0;
	var errorCount = 0;
	var warningCount = 0;
	var updatedTarget = replaceVarReferences(target);
	var updatedValue = replaceVarReferences(value);
	var parsedTarget = parseTarget(updatedTarget);
	var parsedValue = parseValue(updatedValue);
	var compile;	// this is for template processing
	var context = {
		'command': command, 'target': target, 'value': value, 
		'updatedTarget': updatedTarget,	// the target parameter but with configuration variable values substituted.
		'updatedValue': updatedValue,		// the value parameter but with configuration variable values substituted.
		'parsedTarget': parsedTarget,		// targets are often (but not always) of the form xyz=abc.
											// parsedTarget is an associative array { key: xyz, value: abc }
		'parsedValue': parsedValue			// parsedValue is an associative array { key: xyz, value: abc }
	};

	compile = _.template(fs.readFileSync('templates/commandDocs.js'));
	testString += compile(context);

	// Setup the template processing
	if ( isImplementedCommand(command) ) {
		compile = _.template(fs.readFileSync('templates/' + command + '_cmd_impl.js'));
	} else if ( isDefinedCommand(command) ) {
		compile = _.template(fs.readFileSync('templates/unknown_command.js'));
		testString += compile(context);
		console.log('// WARNING: there\'s no implementation of "'+ command + '" at the present time.');
		warningCount += 1;
		return { 'testCount': testCount, 'tests': testString, 'warningCount': warningCount, 'errorCount': errorCount }
	}

	switch (command) {
		case 'open': {
			testString += compile(context);
			break;
		}
		case 'sendKeys':
			// 'sendKeys' and 'type' are the same except sendKeys does not replace
			// existing content. The 'type' commend does.
			// So, sendKeys falls through to 'type'. There, we check for which command
			// is in effect and add '{reset: true }' or '{reset: false }' as needed.
		case 'type': {
			// NOTE: The semantics of 'type' are that it sets the value of the given 
			// element (variable parsedTarget) to the given value (variable updatedValue). 
			// To emulate 'type' in CasperJS, the 'sendKeys' method is used. , The sendKeys 
			// method, however, will only append to the current value of the given element
			// in the DOM. To emulate 'type', we need to replace the value.  Fortunately,
			// sendKeys has an option which will cause the element value to be reset before
			// the new value is sent.
			var selector = '';
			var quotedSelector = '';
			var clickStmt = '';
			var assertMsg = '';
			if ( parsedTarget['key'] === '' || parsedTarget['key'] === 'css' ) {
				selector = parsedTarget['value'];
				quotedSelector = addQuotes(selector);
			} else if ( parsedTarget['key'] === 'id' ) {
				selector = '#' + parsedTarget['value'];
				quotedSelector = addQuotes(selector);
			} else if ( parsedTarget['key'] === 'name' ) {
				// //input[@name="hello world"]
				selector = 'x(\'//input[@name="' + parsedTarget['value'] + '"]\')';
				// when name= is used, we shouldn't add quotes because the x() call needs to be evaluated.
				quotedSelector = selector;
			} else {
				testString += '		// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n';
				console.log('// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n');
				warningCount += 1;
				break;
			}
			context['quotedSelector'] = quotedSelector;
			if ( isLiteral(updatedValue) ) {
				context['quotedValue'] = addQuotes(updatedValue);
			} else {
				context['quotedValue'] = updatedValue;
			}
			testString += compile(context);
			testCount = 1;
			break;
		}
		case 'click': {
			var selector = '';
			var quotedSelector = '';
			var clickExpression = '';
			var assertMsg = '';

			if ( parsedTarget['key'] === '' || parsedTarget['key'] === 'css' ) {
				selector = parsedTarget['value'];
				quotedSelector = addQuotes(selector);
				clickExpression = 'this.click(' + quotedSelector + ')';
			} else if ( parsedTarget['key'] === 'id' ) {
				selector = '#' + parsedTarget['value'];
				quotedSelector = addQuotes(selector);
				clickExpression = 'this.click(' + quotedSelector + ')';
	 		} else if ( parsedTarget['key'] === 'link' ) {
				selector = 'x(\'//a[contains(text(),"' + parsedTarget['value'] + '")]\'';
				// when link= is used, we shouldn't add quotes because the x() call needs to be evaluated.
				quotedSelector = selector;
				clickExpression = 'this.clickLabel(' + addQuotes(parsedTarget['value']) + ', \'a\')';
			} else if ( parsedTarget['key'] === 'xpath' ) {
				selector = 'x(\'' + escapeEmbeddedQuotes(parsedTarget['value']) + '\')';
				quotedSelector = selector;
				clickExpression = 'this.click(' + quotedSelector + ')';
			} else {
				testString += '		// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n';
				console.log('// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n');
				warningCount += 1;
				break;
			}
			context['clickExpression'] = clickExpression;
			context['selector'] = selector;
			context['quotedSelector'] = quotedSelector;
			context['escapedTargetValue'] = escapeEmbeddedQuotes(parsedTarget['value']);
			testString += compile(context);
			testCount = 1;
			break;
		}
		case 'clickAndWait': {
			// var finished = false;
			// casper.once('load.finished', function() { finished = true; });	// do this once
			// casper.then(function() {
			// 		this.click(updatedTarget);				
			// });
			// casper.waitFor(function check() { return finished === true; },
			//				  function then() { this.echo('done waiting'); });
			var selector = '';
			var quotedSelector = '';
			var clickStmt = '';
			var assertMsg = '';
			if ( parsedTarget['key'] === '' || parsedTarget['key'] === 'css' ) {
				quotedSelector = addQuotes(parsedTarget['value']);
				clickExpression = 'this.click(' + quotedSelector + ')';
			} else if ( parsedTarget['key'] === 'id' ) {
				selector = '#' + parsedTarget['value'];
				quotedSelector = addQuotes(selector);
				clickExpression = 'this.click(' + quotedSelector + ')';
			} else if ( parsedTarget['key'] === 'link' ) {
				// Not sure we need the next three lines (because they don't appear to be used) 
				// or if it's a coding error.
				selector = 'x(\'//a[contains(text(),"' + parsedTarget['value'] + '")]\')';
				// when link= is used, we shouldn't add quotes because the x() call needs to be evaluated.
				quotedSelector = selector;
				clickExpression = 'this.clickLabel(' + addQuotes(parsedTarget['value']) + ', \'a\')';
			} else if ( parsedTarget['key'] === 'name' ) {
				selector = 'x(\'//input[@name="' + parsedTarget['value'] + '"]\')';
				// when name= is used, we shouldn't add quotes because the x() call needs to be evaluated.
				clickExpression = 'this.click(' + selector + ', \'a\')';
			} else {
				testString += '		// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n';
				console.log('// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n');
				warningCount += 1;
				break;
			}
			context['flagVar'] = 'finished';
			context['clickExpression'] = clickExpression;
			testString += compile(context);
			testCount = 1;
			break;
		}
		case 'assertConfirmation': {
			context['parsedTarget']['value'] = escapeEmbeddedQuotes(parsedTarget['value']);
			context['timeout'] = 10000;
			testString += compile(context);
			testCount = 1;
			break;
		}
		case 'assertTextPresent': {
			testString += compile(context);
			testCount = 1;
			break;
		}
		case 'assertText': {
			var selector = '';
			var quotedSelector = '';
			var clickStmt = '';
			var assertMsg = '';
			var useQuerySelector = false;
			if ( parsedTarget['key'] === '' || parsedTarget['key'] === 'css' ) {
				selector = parsedTarget['value'];
				quotedSelector = addQuotes(selector);
				assertMsg = '"' + parsedTarget['value'] + '" must be present.';
				useQuerySelector = true;
			} else if ( parsedTarget['key'] === 'id' ) {
				selector = "#" + parsedTarget['value'];
				quotedSelector = addQuotes(selector);
				assertMsg = 'id "' + parsedTarget['value'] + '" must be present.';
				useQuerySelector = true;
			} else if ( parsedTarget['key'] === 'name' ) {
				// If it has a name attribute it must be an input element.
				selector = 'x(\'//input[@name="' + parsedTarget['value'] + '"]\')';
				// when name= is used, we shouldn't add quotes because the x() call needs to be evaluated.
				quotedSelector = selector;
				assertMsg = 'Input named "' + parsedTarget['value'] + '" must be present.';
			} else if ( parsedTarget['key'] === 'xpath' ) {
				selector = 'x(\'' + escapeEmbeddedQuotes(parsedTarget['value']) + '\')';
				quotedSelector = selector;
				assertMsg = 'xpath reference "' + escapeEmbeddedQuotes(parsedTarget['value']) + '" must be present.';
	 		} else if ( parsedTarget['key'] === 'link' ) {
				selector = 'x(\'//a[contains(text(),"' + parsedTarget['value'] + '")]\')';
				// when link= is used, we shouldn't add quotes because the x() call needs to be evaluated.
				quotedSelector = selector;
				assertMsg = 'link containing text "' + escapeEmbeddedQuotes(parsedTarget['value']) + '" must be present.';
			} else {
				testString += '		// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n';
				console.log('// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n');
				warningCount += 1;
				break;
			}
			if ( parsedValue['searchType'] !== 'exact' && parsedValue['searchType'] !== '' ) {
				testString += '		// WARNING: The \'' + parsedValue['searchType'] + '\' search type is not yet supported.\n';
				testString += '		// WARNING: The code below represents an \'exact\' search type.\n';
				console.log('// WARNING: The \'' + parsedValue['searchType'] + '\' search type is not yet supported.\n');

			}
			context['assertMsg'] = assertMsg;
			context['quotedSelector'] = quotedSelector;
			context['selector'] = selector;
			context['useQuerySelector'] = useQuerySelector;
			context['parsedTarget']['value'] = escapeEmbeddedQuotes(parsedTarget['value']);
			context['timeout'] = 10000;
			testString += compile(context);
			testCount = 3;
			break;
		}
		case 'assertTitle': {
			testString += compile(context);
			testCount = 1;
			break;
		}
		case 'assertValue': {
			// just like 'assertText' except it looks for a value of an input field.
			var selector = '';
			var quotedSelector = '';
			var clickStmt = '';
			var assertMsg = '';
			if ( parsedTarget['key'] === '' || parsedTarget['key'] === 'css' ) {
				selector = parsedTarget['value'];
				quotedSelector = addQuotes(selector);
				querySelector = selector;
				assertMsg = '"' + parsedTarget['value'] + '" must be present.';
			} else if ( parsedTarget['key'] === 'id' ) {
				selector = "#" + parsedTarget['value'];
				quotedSelector = addQuotes(selector);
				querySelector = selector;
				assertMsg = 'id "' + parsedTarget['value'] + '" must be present.';
			} else if ( parsedTarget['key'] === 'name' ) {
				// If it has a name attribute it must be an input element.
				selector = 'x(\'//input[@name="' + parsedTarget['value'] + '"]\')';
				quotedSelector = addQuotes(selector);
				querySelector = 'input[name="' + parsedTarget['value'] + '"]';
				assertMsg = 'Input named "' + parsedTarget['value'] + '" must be present.';
			} else {
				testString += '		// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n';
				console.log('// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n');
				warningCount += 1;
				break;
			}
			// when name= is used, we shouldn't add quotes because the x() call needs to be evaluated.
			if ( parsedTarget['key'] === 'name' ) {
				context['selector'] = selector;
			} else {
				context['selector'] = quotedSelector;
			}
			context['quotedSelector'] = quotedSelector;
			context['querySelector'] = querySelector;
			context['assertMsg'] = assertMsg;
			testString += compile(context);
			testCount = 2;
			break;
		}
		case 'assertTable': {
			// this is like assertText except the syntax of target values is special.
			var selector = '';
			var quotedSelector = '';
			var clickStmt = '';
			var assertMsg = '';
			if ( parsedTarget['key'] === '' || parsedTarget['key'] === 'css' || parsedTarget['key'] === 'id' ) {
				// asssertTable takes a target and a value.  The target is of the form:
				//		css=tableName.row.column
				//		id=tableName.row.column
				// Note: row and column in Selenium IDE are zero-based while 
				// rows and columns in xpath numbered starting at 1. Sigh.
				// tableName could look like any one of these:
				//      table           (the table tag)
				//      myTable         (a class name)
				//      #myTable        (an id)
				//      table.myTable   (table tag and class name)
				//      table#myTable   (table tag and id)
				//      
				// We'll parse accordingly and convert to an xpath reference.
				var pattern = /(.*)\.(\d+)\.(\d+)/;
				if ( !pattern.test(parsedTarget['value']) ) {
					testString += '		// WARNING: there\'s no implementation of this assertTable target (\'' + updatedTarget + '\') at the present time.\n';
					testString += '		// You will need to implement this test manually.\n';
					console.log('// WARNING: there\'s no implementation of of this assertTable target (\'' + updatedTarget + '\') at the present time.');
					warningCount += 1;
				} else {
					var pieces = parsedTarget['value'].match(pattern);
					var tableName = pieces[1];
					var row = parseInt(pieces[2]) + 1;
					var col = parseInt(pieces[3]) + 1;

					var tableNamePattern = /table([\.\#])(.*)/;		// looking for table.myTable or table#myTable
					if ( tableNamePattern.test(tableName) ) {
						var tnPieces = tableName.match(tableNamePattern);
						var tblNameOrId = tnPieces[2];
						// tableNamePattern matched, xpath looks like this:
						//    table[@class='{tnPieces[2]}']/tbody/tr[{row}]/*[{col}][name()="TD" or name()="td" or name()="TH" or name()="th"]
						// or
						//    table[@id='{tnPieces[2]}']/tbody/tr[{row}]/*[{col}][name()="TD" or name()="td" or name()="TH" or name()="th"]
						//
						// NOTE: the xpaths above have the '[name()="TD" or name()="td" ...]' at the end to 
						// emulate Selenium IDE behavior. In the IDE {col} is a column number which does not
						// care whether columns are defined with th or td tags. We need to access column 
						// number {col} regardless of whether the row has td or th tags or even a mix of the
						// two. The '[name()="TD" or name()="td" ...]' part allows us to do that.
						// NOTE: depending on the browser, the tag names could be uppercase or lowercase.
						if ( tnPieces[1] === '.' ) {
							selector = 'x(\'//table[@class="' + tblNameOrId + '"]/tbody/tr[' + row + ']/*[' + col + '][name()="TD" or name()="td" or name()="TH" or name()="th"]\')';
						} else {
							selector = 'x(\'//table[@id="' + tblNameOrId + '"]/tbody/tr[' + row + ']/*[' + col + '][name()="TD" or name()="td" or name()="TH" or name()="th"]\')';
						}

					} else if ( tableName === 'table' ) {
						// if tableNamePattern doesn't match, it might be just a raw table name
						// and the xpath will look like this: table/tbody/tr[{row}]/*[{col}][name()="TD" or name()="td" or name()="TH" or name()="th"]
						selector = 'x(\'//table/tbody/tr[' + row + ']/td[' + col + '][name()="TD" or name()="td" or name()="TH" or name()="th"]\')';
					} else {
						// otherwise, we have just a table class or id
						// //*[@class={tableName}]/tbody/tr[{row}]/*[{col}][name()="TD" or name()="td" or name()="TH" or name()="th"]
						// //*[@id={tableName}]/tbody/tr[{row}]/*[{col}][name()="TD" or name()="td" or name()="TH" or name()="th"]
						if ( tableName.charAt(0) === '#' ) {
							selector = 'x(\'//table[@id="' + tableName.substr(1) + '"]/tbody/tr[' + row + ']/*[' + col + '][name()="TD" or name()="td" or name()="TH" or name()="th"]\')';
						} else if ( parsedTarget['key'] === 'id' ) {
							selector = 'x(\'//table[@id="' + tableName + '"]/tbody/tr[' + row + ']/*[' + col + '][name()="TD" or name()="td" or name()="TH" or name()="th"]\')';
						} else {
							selector = 'x(\'//table[@class="' + tableName + '"]/tbody/tr[' + row + ']/*[' + col + '][name()="TD" or name()="td" or name()="TH" or name()="th"]\')';
						}
					}
				}
				context['selector'] = selector;
				context['timeout'] = 10000;
				testString += compile(context);
				testCount = 3;
				break;
			}
			// if we get here, we don't know how to translate the target.
			testString += '		// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n';
			console.log('// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n');
			warningCount += 1;
			break;
		}
		case 'goBack': {
			testString += compile(context);
			break;
		}
		case 'goBackAndWait': {
			context['flagVar'] = 'finished';
			testString += compile(context);
			testCount = 1;
			break;
		}
		case 'pause': {
			testString += compile(context);
			break;
		}
		case 'select': {
			var selector = '';
			var quotedSelector = '';
			var assertMsg = '';
			if ( parsedTarget['key'] === '' || parsedTarget['key'] === 'css' ) {
				selector = parsedTarget['value'];
				quotedSelector = addQuotes(selector);
				querySelector = 'select[css="' + parsedTarget['value'] + '"]';
			} else if ( parsedTarget['key'] === 'id' ) {
				selector = '#' + parsedTarget['value'];
				quotedSelector = addQuotes(selector);
				querySelector = 'select[id="' + parsedTarget['value'] + '"]';
			} else if ( parsedTarget['key'] === 'name' ) {
				// If it has a name attribute, we have to find it via an xpath
				selector = 'x(\'//select[@name="' + parsedTarget['value'] + '"]\')';
				quotedSelector = selector;	// can't add quotes because x(...) must be evaluated at runtime.
				querySelector = 'select[name="' + parsedTarget['value'] + '"]';
			} else {
				testString += '		// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n';
				console.log('// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n');
				warningCount += 1;
				break;
			}
			var parsedValue = parseTarget(updatedValue);
			var value = parsedValue['value'];
			var quotedValue = addQuotes(value);
			// TODO: The if...else if... can be simplified since all we're doing is
			// stuffing the value of parsedValue['key'] into form and then form
			// into context['form']
			if ( parsedValue['key'] === 'value' ) {
				form = 'value'
			} else if ( parsedValue['key'] === 'index' ) {
				form = 'index';
			} else if ( parsedValue['key'] === 'id' ) {
				form = 'id';
			} else  {
				// default is 'label'
				form = 'label';
			}
			context['form'] = form;
			context['parsedValue'] = parsedValue;
			context['quotedValue'] = quotedValue;
			context['quotedSelector'] = quotedSelector;
			context['querySelector'] = querySelector;
			testString += compile(context);
			testCount = 1;
			break;
		}
		case 'selectAndWait': {
			var selector = '';
			var quotedSelector = '';
			var assertMsg = '';
			if ( parsedTarget['key'] === '' || parsedTarget['key'] === 'css' ) {
				selector = parsedTarget['value'];
				quotedSelector = addQuotes(selector);
				querySelector = 'select[css="' + parsedTarget['value'] + '"]';
			} else if ( parsedTarget['key'] === 'name' ) {
				selector = parsedTarget['value'];
				// quotedSelector = addQuotes(selector);
				quotedSelector = 'x(\'//select[@name="' + parsedTarget['value'] + '"]\')';
				querySelector = 'select[name="' + parsedTarget['value'] + '"]';
			} else if ( parsedTarget['key'] === 'id' ) {
				selector = '#' + parsedTarget['value'];
				quotedSelector = 'x(\'//select[@id="' + parsedTarget['value'] + '"]\')';
				querySelector = 'select[id="' + parsedTarget['value'] + '"]';
			} else {
				testString += '		// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n';
				console.log('// WARNING: The target value \'' + addQuotes(updatedTarget) + '\' can\'t be translated.\n');
				warningCount += 1;
				break;
			}
			var parsedValue = parseTarget(updatedValue);
			var value = parsedValue['value'];
			var quotedValue = addQuotes(value);
			// TODO: The if...else if... can be simplified since all we're doing is
			// stuffing the value of parsedValue['key'] into form and then form
			// into context['form']
			if ( parsedValue['key'] === 'value' ) {
				form = 'value';
			} else if ( parsedValue['key'] === 'index' ) {
				form = 'index';
			} else if ( parsedValue['key'] === 'id' ) {
				form = 'id';
			} else if ( parsedValue['key'] === 'name' ) {
				form = 'name';
			} else  {
				// default is 'label'
				form = 'label';
			}
			context['form'] = form;
			context['parsedValue'] = parsedValue;
			context['quotedValue'] = quotedValue;
			context['quotedSelector'] = quotedSelector;
			context['querySelector'] = querySelector;
			context['flagVar'] = 'finished';
			testString += compile(context);
			testCount = 2;
			break;
		}
		default: {
			console.log('// ERROR: "' + command + '" is an unknown command and cannot be processed.');
			errorCount += 1;
		}
	}
	return { 'testCount': testCount, 'tests': testString, 'warningCount': warningCount, 'errorCount': errorCount }
}
var testCount = 0;
var m;

while ((m = re.exec(contents)) != null) {
	if (m.index === re.lastIndex) {
		re.lastIndex++;
	}
	// View your result using the m-variable.
	// eg m[0] etc.
	var status = processStep(m[1], m[2], m[3]);
	testsString += status.tests;
	testCount += status.testCount;
	warningCount += status.warningCount;
	errorCount += status.errorCount;
}
testsString += '		//////////////////////////////////////////////////////////////\n';

if ( errorCount == 0  && ( !args['l'] && !args['lint'] ) ) {
	console.log(getStandardDefinitions(file2read, testCount));
	console.log(testsString);
	console.log(getClosingStatements());
}
console.log(getMessaging(warningCount, errorCount));
