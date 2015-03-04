// Selenium Filename: <%= fileName %>
// Date: <%= date %>
//
var system = require('system');
var fs = require('fs');
var config_file = system.env.CASPERJS_CONFIG_FILE;
var base = system.env.CASPERJS_BASE;

var utils = require(base + '/lib/test-utils');
casper.on('error', utils.traceback);
casper.on('page.error', utils.traceback);

var config_file = system.env.CASPERJS_CONFIG_FILE;
var loadReturnStatus = utils.loadConfig(config_file);	// loadConfig sets properties of the utils object. Returns true on success.

var x = utils.selectXPath;	// shortcut for selectXPath()
var finished;							// used by 'clickAndWait'
var confirmMessage;						// used by 'assertConfirmation'
var expectedConfirmMessage;				// used by 'assertConfirmation'
var confirmMessageReceived = false;		// used by 'assertConfirmation'

casper.on('resource.error', utils.resourceErrorFunction);

casper.test.begin('<%= testName %>', <%= testCount %>, {
	setUp: function(test) {
		console.log('setup...');
		// If we're rendering with 'slimerjs', set the viewport to a size that will allow us to see things.
	    if ( utils.getCasperEngine() === 'slimer' ) {
	    	console.log('Setting viewport size...');
			casper.options.viewportSize = {width: 1024, height: 768};
	    }
		casper.removeAllFilters('page.confirm');
		casper.setFilter("page.confirm", function(msg) {
			console.log('A confirmation dialog with the message "' + msg + '" has appeared.');
			confirmMessage = msg;
			confirmMessageReceived = true;
			return true;
		});
	},
	tearDown: function(test) {
		console.log('teardown...');
		casper.removeAllFilters('page.confirm');
	},
	test: function(test) {
	    casper.start();
	    if ( utils.get('useBasicAuth') ) {
	    	casper.setHttpAuth(utils.get('basicAuthUsername'), utils.get('basicAuthPassword'));
	    }
