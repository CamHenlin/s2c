		casper.waitForSelector(<%= quotedSelector %>,
		   function success() {
				test.assertExists(<%= quotedSelector %>, '<%= parsedTarget.key %> value "<%= parsedTarget.value %>" must be present.');
				this.sendKeys(<%= quotedSelector %>, <%= quotedValue %>, { 'reset': true });
		     },
		   function fail() {
		       test.assertExists(<%= quotedSelector  %>, '<%= parsedTarget.key %> value "<%= parsedTarget.value %>" must be present.');
		});
